/**
 * PsychRx State Expansion Worker
 * ------------------------------
 * Runs every Monday at 9am (office timezone) and checks 4 readiness
 * thresholds before recommending the next state expansion:
 *
 *   1. Fill rate > 80% for 4 consecutive weeks (from platform_metrics history)
 *   2. At least 10 active providers in the current state
 *   3. At least 50 active patients in the current state
 *   4. Claims paid rate > 70% (paid / adjudicated insurance claims)
 *
 * If all 4 pass, Patrick (OWNER_PHONE) gets an SMS with the expansion
 * recommendation. Every check is logged to worker_logs.
 */
import cron from "node-cron";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSms } from "@/lib/sms";
import { withWorkerLog } from "@/workers/worker-log";

const WORKER_NAME = "state-expansion";
const OFFICE_TIMEZONE = process.env.OFFICE_TIMEZONE ?? "America/New_York";
const OWNER_PHONE = process.env.OWNER_PHONE ?? "";
/** State the platform currently operates in. */
const CURRENT_STATE = process.env.CURRENT_STATE ?? "FL";
/** Ranked candidate states (owner already holds licenses in WA, CO, CA). */
const CANDIDATE_STATES = (process.env.EXPANSION_CANDIDATE_STATES ?? "WA,CO,CA")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

const FILL_RATE_THRESHOLD = 80; // percent
const FILL_RATE_WEEKS = 4;
const MIN_ACTIVE_PROVIDERS = 10;
const MIN_ACTIVE_PATIENTS = 50;
const CLAIMS_PAID_RATE_THRESHOLD = 70; // percent

interface ThresholdCheck {
  name: string;
  passed: boolean;
  detail: string;
}

/** Fill rate > 80% for each of the last 4 weekly windows (platform_metrics). */
async function checkFillRateStreak(): Promise<ThresholdCheck> {
  const since = new Date(Date.now() - FILL_RATE_WEEKS * 7 * 86_400_000).toISOString();
  const { data } = await supabaseAdmin
    .from("platform_metrics")
    .select("recorded_at, fill_rate")
    .gte("recorded_at", since)
    .not("fill_rate", "is", null)
    .order("recorded_at", { ascending: true });

  const rows =
    (data as Array<{ recorded_at: string; fill_rate: number }> | null) ?? [];

  // Bucket snapshots into 7-day windows counting back from now.
  const weekly: number[][] = Array.from({ length: FILL_RATE_WEEKS }, () => []);
  for (const row of rows) {
    const ageDays = (Date.now() - new Date(row.recorded_at).getTime()) / 86_400_000;
    const bucket = Math.min(Math.floor(ageDays / 7), FILL_RATE_WEEKS - 1);
    weekly[bucket].push(Number(row.fill_rate));
  }

  const weeklyAvgs = weekly.map((values) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  );
  const passed = weeklyAvgs.every((avg) => avg !== null && avg > FILL_RATE_THRESHOLD);
  const detail = weeklyAvgs
    .map((avg, i) => `wk-${i + 1}: ${avg === null ? "no data" : `${avg.toFixed(1)}%`}`)
    .join(", ");
  return {
    name: `fill rate > ${FILL_RATE_THRESHOLD}% for ${FILL_RATE_WEEKS} consecutive weeks`,
    passed,
    detail,
  };
}

async function checkActiveProviders(): Promise<ThresholdCheck> {
  const { count } = await supabaseAdmin
    .from("providers")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .eq("license_state", CURRENT_STATE);
  const n = count ?? 0;
  return {
    name: `>= ${MIN_ACTIVE_PROVIDERS} active providers in ${CURRENT_STATE}`,
    passed: n >= MIN_ACTIVE_PROVIDERS,
    detail: `${n} active provider(s)`,
  };
}

async function checkActivePatients(): Promise<ThresholdCheck> {
  const { count } = await supabaseAdmin
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .eq("state", CURRENT_STATE);
  const n = count ?? 0;
  return {
    name: `>= ${MIN_ACTIVE_PATIENTS} active patients in ${CURRENT_STATE}`,
    passed: n >= MIN_ACTIVE_PATIENTS,
    detail: `${n} active patient(s)`,
  };
}

async function checkClaimsPaidRate(): Promise<ThresholdCheck> {
  const adjudicated = ["paid", "partially_paid", "denied", "rejected"];
  const countByStatus = async (statuses: string[]) => {
    const { count } = await supabaseAdmin
      .from("insurance_claims")
      .select("id", { count: "exact", head: true })
      .in("status", statuses);
    return count ?? 0;
  };

  const total = await countByStatus(adjudicated);
  const paid = await countByStatus(["paid", "partially_paid"]);
  const rate = total > 0 ? (paid / total) * 100 : 0;
  return {
    name: `claims paid rate > ${CLAIMS_PAID_RATE_THRESHOLD}%`,
    passed: total > 0 && rate > CLAIMS_PAID_RATE_THRESHOLD,
    detail: `${paid}/${total} adjudicated claims paid (${rate.toFixed(1)}%)`,
  };
}

/** Run one expansion-readiness check. Returns true if a recommendation went out. */
export async function runStateExpansionOnce(): Promise<boolean> {
  let recommended = false;

  await withWorkerLog(WORKER_NAME, async () => {
    const checks: ThresholdCheck[] = [
      await checkFillRateStreak(),
      await checkActiveProviders(),
      await checkActivePatients(),
      await checkClaimsPaidRate(),
    ];

    const allPassed = checks.every((c) => c.passed);
    const summary = checks
      .map((c) => `${c.passed ? "PASS" : "FAIL"} ${c.name} (${c.detail})`)
      .join("; ");

    if (allPassed) {
      const nextState = CANDIDATE_STATES[0] ?? "next state";
      const message =
        `PsychRx expansion check: ${CURRENT_STATE} passed all 4 readiness thresholds. ` +
        `Recommended next state: ${nextState}` +
        (CANDIDATE_STATES.length > 1
          ? ` (then ${CANDIDATE_STATES.slice(1).join(", ")})`
          : "") +
        `. Reply YES to approve or NO to skip.`;

      if (OWNER_PHONE) {
        await sendSms(OWNER_PHONE, message, {
          recipientType: "owner",
          subject: "State expansion recommendation",
        });
        recommended = true;
      } else {
        console.warn(`[${WORKER_NAME}] all thresholds passed but OWNER_PHONE is not set`);
      }
    }

    return {
      records: checks.filter((c) => c.passed).length,
      message: allPassed
        ? `ALL THRESHOLDS PASSED — recommended ${CANDIDATE_STATES[0] ?? "expansion"} to owner. ${summary}`
        : `not ready for expansion. ${summary}`,
    };
  });

  return recommended;
}

/** Schedule the check for Mondays at 9:00am office time. */
export function startStateExpansionWorker(): void {
  console.log(`[${WORKER_NAME}] scheduled Mondays at 09:00 (${OFFICE_TIMEZONE})`);
  cron.schedule("0 9 * * 1", () => void runStateExpansionOnce(), {
    timezone: OFFICE_TIMEZONE,
  });
}

// Run directly: schedule, or `RUN_ONCE=1 tsx workers/state-expansion.ts` for one pass.
if (require.main === module) {
  if (process.env.RUN_ONCE) {
    void runStateExpansionOnce().then(() => process.exit(0));
  } else {
    startStateExpansionWorker();
  }
}
