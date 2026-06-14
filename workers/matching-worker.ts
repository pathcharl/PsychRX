/**
 * PsychRx Matching Worker
 * -----------------------
 * Runs every 60 seconds and:
 *   1. releases expired slot holds
 *   2. expires slot offers the patient never answered (after OFFER_MINUTES)
 *   3. picks up waitlist patients with status = 'waiting'
 *   4. runs the matching engine (lib/matching.ts) to find provider + slot
 *   5. texts the patient a slot offer (reply YES to confirm)
 *
 * Matching events go to match_log; each run is recorded in worker_logs.
 */
import cron from "node-cron";
import { supabaseAdmin } from "@/lib/supabase";
import {
  findBestMatchWithSlot,
  holdSlot,
  releaseExpiredHolds,
  logMatch,
  type MatchPatient,
} from "@/lib/matching";
import { sendPatientNotification } from "@/lib/sms";
import { withWorkerLog } from "@/workers/worker-log";

const WORKER_NAME = "matching-worker";
const OFFICE_TIMEZONE = process.env.OFFICE_TIMEZONE ?? "America/New_York";
/** Unresponded offers expire after 30 minutes. */
const OFFER_MINUTES = Number(process.env.MATCH_OFFER_MINUTES ?? 30);
const BATCH_SIZE = Number(process.env.MATCH_BATCH_SIZE ?? 20);

interface WaitlistRow {
  id: string;
  patient_id: string;
  care_type: string | null;
  language: string | null;
  insurance: string | null;
  /** Present on some waitlist schemas (core product spec). */
  insurance_payer?: string | null;
}

/** Columns that exist on the production patients table (see lib/intake.ts). */
const PATIENT_COLS =
  "id, first_name, last_name, phone, status, insurance_primary_payer_name, preferred_language, preferred_provider_type, care_type";

const WAITLIST_COLS =
  "id, patient_id, care_type, language, insurance, insurance_payer, priority, created_at";

interface PatientRow {
  id: string;
  first_name: string | null;
  phone: string | null;
  insurance_provider: string | null;
  /** From patients.language if column exists; otherwise from waitlist. */
  language: string | null;
  /** From patients.care_type if column exists; otherwise from waitlist. */
  care_type: string | null;
}

function normalizePatientRow(row: Record<string, unknown>): PatientRow {
  return {
    id: String(row.id),
    first_name: (row.first_name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    insurance_provider: (row.insurance_primary_payer_name as string | null) ?? null,
    language: (row.preferred_language as string | null) ?? null,
    care_type:
      (row.care_type as string | null) ??
      (row.preferred_provider_type as string | null) ??
      null,
  };
}

async function getPatient(patientId: string): Promise<PatientRow | null> {
  const id = patientId.trim();
  const queryDesc =
    `from("patients").select("${PATIENT_COLS}").eq("id", "${id}").maybeSingle()`;
  console.log(`[${WORKER_NAME}] patient lookup: ${queryDesc}`);

  const { data, error } = await supabaseAdmin
    .from("patients")
    .select(PATIENT_COLS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(
      `[${WORKER_NAME}] patient lookup failed for ${patientId}:`,
      error.message,
      error.code ? `(code ${error.code})` : "",
      error.details ?? "",
      error.hint ?? ""
    );
    return null;
  }

  if (!data) {
    // Defensive: confirm whether the id exists at all (helps distinguish bad id vs bad select).
    const probeDesc = `from("patients").select("id").eq("id", "${id}").maybeSingle()`;
    console.log(`[${WORKER_NAME}] patient lookup: ${probeDesc}`);
    const { data: probe, error: probeError } = await supabaseAdmin
      .from("patients")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (probeError) {
      console.error(`[${WORKER_NAME}] patient id probe failed:`, probeError.message);
    } else if (probe) {
      console.warn(
        `[${WORKER_NAME}] patient id=${id} exists but select returned null — unexpected`
      );
    } else {
      console.warn(`[${WORKER_NAME}] patient lookup: no row in patients for id=${id}`);
    }
    return null;
  }

  const patient = normalizePatientRow(data as Record<string, unknown>);
  console.log(
    `[${WORKER_NAME}] patient lookup ok: id=${patient.id}, name=${patient.first_name ?? "?"}, ` +
      `status=${(data as { status?: string }).status ?? "?"}, ` +
      `insurance=${patient.insurance_provider ?? "—"}, care_type=${patient.care_type ?? "—"}`
  );
  return patient;
}

function formatSlotTime(iso: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: OFFICE_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: OFFICE_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${day} at ${time}`;
}

/** Reset waitlist offers that the patient never answered within the window. */
async function expireStaleOffers(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("waitlist")
    .select("id, patient_id, offered_provider_id, offered_slot_id")
    .eq("status", "offered")
    .lt("offer_expires_at", new Date().toISOString());

  const stale =
    (data as Array<{
      id: string;
      patient_id: string;
      offered_provider_id: string | null;
      offered_slot_id: string | null;
    }> | null) ?? [];

  for (const offer of stale) {
    await supabaseAdmin
      .from("waitlist")
      .update({
        status: "waiting",
        offered_slot_id: null,
        offered_provider_id: null,
        offered_at: null,
        offer_expires_at: null,
      })
      .eq("id", offer.id);
    await logMatch({
      patientId: offer.patient_id,
      providerId: offer.offered_provider_id,
      slotId: offer.offered_slot_id,
      action: "offer_expired",
    });
  }
  return stale.length;
}

/** One matching pass. Returns the number of new offers made. */
export async function runMatchingOnce(): Promise<number> {
  let offered = 0;

  await withWorkerLog(WORKER_NAME, async () => {
    const released = await releaseExpiredHolds();
    const expired = await expireStaleOffers();

    const waitlistQuery =
      `from("waitlist").select("${WAITLIST_COLS}").eq("status", "waiting")` +
      `.order("priority").limit(${BATCH_SIZE})`;
    console.log(`[${WORKER_NAME}] waitlist query: ${waitlistQuery}`);

    const { data: waiting, error: waitlistError } = await supabaseAdmin
      .from("waitlist")
      .select(WAITLIST_COLS)
      .eq("status", "waiting")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    const waitlistRows = (waiting as WaitlistRow[] | null) ?? [];

    if (waitlistError) {
      console.error(`[${WORKER_NAME}] waitlist query failed:`, waitlistError.message);
    }

    console.log(
      `[${WORKER_NAME}] found ${waitlistRows.length} waitlist patient(s) with status=waiting ` +
        `(batch limit=${BATCH_SIZE})`
    );

    let loggedPatientCount = false;

    for (const entry of waitlistRows) {
      const patient = await getPatient(entry.patient_id);

      if (!patient) {
        if (!loggedPatientCount) {
          loggedPatientCount = true;
          const { count, error: countErr } = await supabaseAdmin
            .from("patients")
            .select("id", { count: "exact", head: true });
          if (countErr) {
            console.error(`[${WORKER_NAME}] patients count failed:`, countErr.message);
          } else {
            console.warn(
              `[${WORKER_NAME}] patients table has ${count ?? 0} row(s) — waitlist ` +
                `patient_id may be orphaned. Run: npx tsx --env-file=.env.local ` +
                `scripts/repair-waitlist-patients.ts`
            );
          }
        }
        console.warn(
          `[${WORKER_NAME}] waitlist entry ${entry.id}: patient ${entry.patient_id} not found — skipping`
        );
        continue;
      }

      const matchInput: MatchPatient = {
        id: patient.id,
        insurance_provider:
          entry.insurance ?? entry.insurance_payer ?? patient.insurance_provider,
        language: entry.language ?? patient.language,
        care_type: entry.care_type ?? patient.care_type,
      };

      console.log(
        `[${WORKER_NAME}] matching ${patient.first_name ?? "patient"} (${patient.id}) — ` +
          `care_type=${matchInput.care_type ?? "(none)"}, ` +
          `insurance=${matchInput.insurance_provider ?? "(none)"}, ` +
          `language=${matchInput.language ?? "English"} ` +
          `(waitlist: care_type=${entry.care_type ?? "—"}, insurance=${entry.insurance ?? "—"})`
      );

      const match = await findBestMatchWithSlot(matchInput);
      if (!match) {
        console.log(
          `[${WORKER_NAME}] no match for patient ${patient.id} (${patient.first_name ?? "unknown"}) — see [matching] logs above`
        );
        await logMatch({
          patientId: patient.id,
          action: "no_match",
          details: {
            care_type: matchInput.care_type,
            insurance: matchInput.insurance_provider,
            language: matchInput.language,
          },
        });
        continue;
      }

      // Hold the slot for the duration of the offer window.
      const held = await holdSlot(match.slot.id, patient.id, OFFER_MINUTES);
      if (!held) {
        console.warn(
          `[${WORKER_NAME}] patient ${patient.id}: slot ${match.slot.id} lost between match and hold — retry next pass`
        );
        continue;
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + OFFER_MINUTES * 60_000);
      await supabaseAdmin
        .from("waitlist")
        .update({
          status: "offered",
          offered_slot_id: match.slot.id,
          offered_provider_id: match.provider.id,
          offered_at: now.toISOString(),
          offer_expires_at: expiresAt.toISOString(),
        })
        .eq("id", entry.id);

      const providerName =
        [match.provider.first_name, match.provider.last_name]
          .filter(Boolean)
          .join(" ") || "one of our providers";
      const message =
        `Hi ${patient.first_name ?? "there"}, we found an appointment with ` +
        `${providerName} on ${formatSlotTime(match.slot.start_time)}. ` +
        `Reply YES to confirm or NO to decline. This offer expires in ${OFFER_MINUTES} minutes.`;

      try {
        if (patient.phone) {
          await sendPatientNotification({ id: patient.id, phone: patient.phone }, message);
        }
      } catch (err) {
        console.error(`[${WORKER_NAME}] offer SMS failed:`, err);
      }

      await logMatch({
        patientId: patient.id,
        providerId: match.provider.id,
        slotId: match.slot.id,
        score: match.score,
        action: "offered",
        details: { breakdown: match.breakdown },
      });
      console.log(
        `[${WORKER_NAME}] offered slot to ${patient.first_name ?? patient.id} — ` +
          `provider=${match.provider.id}, slot=${match.slot.start_time}, score=${match.score}`
      );
      offered += 1;
    }

    return {
      records: offered,
      message: `released=${released} expired=${expired} offered=${offered}`,
    };
  });

  return offered;
}

/** Schedule the worker to run every 60 seconds. */
export function startMatchingWorker(): void {
  console.log(`[${WORKER_NAME}] scheduled every 60 seconds`);
  cron.schedule("* * * * *", () => void runMatchingOnce());
  void runMatchingOnce();
}

// Run directly: `tsx workers/matching-worker.ts`
// One pass:       RUN_ONCE=1 tsx --env-file=.env.local workers/matching-worker.ts
if (require.main === module) {
  if (process.env.RUN_ONCE) {
    void runMatchingOnce().then(() => process.exit(0));
  } else {
    startMatchingWorker();
  }
}
