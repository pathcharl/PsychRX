/**
 * PsychRx Balance Engine
 * ----------------------
 * Runs every 4 hours. Compares active provider count vs active patient count,
 * computes the platform-wide fill rate, and decides how the daily outreach fax
 * budget should be split between patient-referral outreach and provider
 * recruitment:
 *
 *   fill rate < 60%  → providers are under-filled → shift faxes toward
 *                      PATIENT REFERRAL outreach (more patients needed)
 *   fill rate > 85%  → providers are nearly full  → shift faxes toward
 *                      PROVIDER RECRUITMENT (more supply needed)
 *   otherwise        → balanced allocation
 *
 * Note: this follows the SPEC.md balance worker (low fill → referrer-heavy,
 * high fill → recruit-heavy). The campaign worker reads the latest
 * platform_metrics row and applies `computeFaxAllocation` to its daily budget.
 *
 * Every run inserts a platform_metrics snapshot and logs the decision +
 * reasoning to worker_logs.
 */
import cron from "node-cron";
import { supabaseAdmin } from "@/lib/supabase";
import { withWorkerLog } from "@/workers/worker-log";

const WORKER_NAME = "balance-engine";
/** How far ahead to look when computing fill rate from provider_slots. */
const FILL_WINDOW_DAYS = Number(process.env.FILL_WINDOW_DAYS ?? 14);
const FILL_LOW_THRESHOLD = 60; // percent
const FILL_HIGH_THRESHOLD = 85; // percent

export interface FaxAllocation {
  /** Fraction of the daily fax budget for patient-referral outreach (0..1). */
  referral: number;
  /** Fraction of the daily fax budget for provider recruitment (0..1). */
  recruit: number;
  decision: "boost_patient_referrals" | "boost_provider_recruitment" | "maintain_balance";
}

/** Map a platform fill rate (percent) to a fax budget split. */
export function computeFaxAllocation(fillRatePct: number | null): FaxAllocation {
  if (fillRatePct !== null && fillRatePct < FILL_LOW_THRESHOLD) {
    return { referral: 0.8, recruit: 0.2, decision: "boost_patient_referrals" };
  }
  if (fillRatePct !== null && fillRatePct > FILL_HIGH_THRESHOLD) {
    return { referral: 0.3, recruit: 0.7, decision: "boost_provider_recruitment" };
  }
  return { referral: 0.6, recruit: 0.4, decision: "maintain_balance" };
}

async function exactCount(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
  label = ""
): Promise<number> {
  const { count, error } = await query;
  if (error) {
    // Optional tables (e.g. insurance_claims) may not exist in this DB.
    console.warn(`[${WORKER_NAME}] count query${label ? ` (${label})` : ""} failed: ${error.message} — using 0`);
    return 0;
  }
  return count ?? 0;
}

/** Fill rate (percent) across all active providers' upcoming slots. */
async function computePlatformFillRate(): Promise<number | null> {
  const now = new Date().toISOString();
  const horizon = new Date(Date.now() + FILL_WINDOW_DAYS * 86_400_000).toISOString();

  const slotCount = (status: string[]) =>
    supabaseAdmin
      .from("provider_slots")
      .select("id", { count: "exact", head: true })
      .in("status", status)
      .gte("start_time", now)
      .lte("start_time", horizon);

  const [{ count: booked }, { count: total }] = await Promise.all([
    slotCount(["booked"]),
    slotCount(["open", "held", "booked"]),
  ]);

  if (!total) return null;
  return Math.round(((booked ?? 0) / total) * 10_000) / 100;
}

/** Run one balance pass: snapshot metrics + decide fax allocation. */
export async function runBalanceEngineOnce(): Promise<void> {
  await withWorkerLog(WORKER_NAME, async () => {
    const weekStart = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const activeProviders = await exactCount(
      supabaseAdmin
        .from("providers")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
    );
    const activePatients = await exactCount(
      supabaseAdmin
        .from("patients")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
    );
    const appointmentsThisWeek = await exactCount(
      supabaseAdmin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .gte("scheduled_at", weekStart)
        .in("status", ["scheduled", "confirmed", "completed", "rescheduled"]),
      "appointments"
    );

    // Pending insurance work lives on encounters.claim_status in this schema.
    const claimsPending = await exactCount(
      supabaseAdmin
        .from("encounters")
        .select("id", { count: "exact", head: true })
        .in("claim_status", ["draft", "submitted", "accepted", "pending"]),
      "claims pending"
    );

    // Revenue this week: insurance-paid encounter amounts (no payments table).
    const { data: weekEncounters, error: weekErr } = await supabaseAdmin
      .from("encounters")
      .select("paid_amount")
      .gte("created_at", weekStart)
      .not("paid_amount", "is", null);
    if (weekErr) {
      console.warn(`[${WORKER_NAME}] revenue query failed: ${weekErr.message} — using 0`);
    }
    const revenueThisWeek = (weekEncounters ?? []).reduce(
      (sum: number, p: { paid_amount: number | null }) => sum + Number(p.paid_amount ?? 0),
      0
    );

    // Claims paid this month.
    const { data: paidClaims, error: paidErr } = await supabaseAdmin
      .from("encounters")
      .select("paid_amount")
      .eq("claim_status", "paid")
      .gte("created_at", monthStart.toISOString());
    if (paidErr) {
      console.warn(`[${WORKER_NAME}] paid-claims query failed: ${paidErr.message} — using 0`);
    }
    const claimsPaidThisMonth = (paidClaims ?? []).reduce(
      (sum: number, c: { paid_amount: number | null }) => sum + Number(c.paid_amount ?? 0),
      0
    );

    // Provider mix by type.
    const { data: providerTypes } = await supabaseAdmin
      .from("providers")
      .select("provider_type, specialties")
      .eq("status", "active");
    const providersByType: Record<string, number> = {};
    const specialtyMix: Record<string, number> = {};
    for (const p of (providerTypes as Array<{
      provider_type: string | null;
      specialties: string[] | null;
    }> | null) ?? []) {
      const type = p.provider_type ?? "unknown";
      providersByType[type] = (providersByType[type] ?? 0) + 1;
      const specs = p.specialties?.length ? p.specialties : ["unspecified"];
      for (const spec of specs) {
        specialtyMix[spec] = (specialtyMix[spec] ?? 0) + 1;
      }
    }

    const fillRate = await computePlatformFillRate();
    const allocation = computeFaxAllocation(fillRate);

    await supabaseAdmin.from("platform_metrics").insert({
      active_providers: activeProviders,
      providers_by_type: providersByType,
      active_patients: activePatients,
      appointments_this_week: appointmentsThisWeek,
      revenue_this_week: revenueThisWeek,
      claims_pending: claimsPending,
      claims_paid_this_month: claimsPaidThisMonth,
      fill_rate: fillRate,
      specialty_mix: specialtyMix,
    });

    const reasoning =
      fillRate === null
        ? "no upcoming slots to measure fill rate; maintaining balanced allocation"
        : allocation.decision === "boost_patient_referrals"
          ? `fill rate ${fillRate}% < ${FILL_LOW_THRESHOLD}% — providers under-filled, boosting patient referral faxes`
          : allocation.decision === "boost_provider_recruitment"
            ? `fill rate ${fillRate}% > ${FILL_HIGH_THRESHOLD}% — capacity tight, boosting provider recruitment faxes`
            : `fill rate ${fillRate}% within healthy band — maintaining balanced allocation`;

    return {
      records: 1,
      message:
        `providers=${activeProviders} patients=${activePatients} ` +
        `fill_rate=${fillRate ?? "n/a"}% decision=${allocation.decision} ` +
        `(referral=${Math.round(allocation.referral * 100)}% ` +
        `recruit=${Math.round(allocation.recruit * 100)}%): ${reasoning}`,
    };
  });
}

/** Schedule the engine to run every 4 hours. */
export function startBalanceEngine(): void {
  console.log(`[${WORKER_NAME}] scheduled every 4 hours`);
  cron.schedule("0 */4 * * *", () => void runBalanceEngineOnce());
  void runBalanceEngineOnce();
}

// Run directly: `tsx workers/balance-engine.ts`
if (require.main === module) {
  startBalanceEngine();
}
