/**
 * PsychRx Matching Worker (background)
 * ------------------------------------
 * Runs every ~60 seconds and:
 *   1. releases expired slot holds
 *   2. expires unanswered slot offers (older than OFFER_MINUTES)
 *   3. matches waiting patients to providers + open slots
 *   4. texts the patient a slot offer (reply YES to confirm)
 *
 * All matching events are written to match_log; runs are recorded in workers_log.
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

const OFFICE_TIMEZONE = process.env.OFFICE_TIMEZONE ?? "America/New_York";
const OFFER_MINUTES = Number(process.env.MATCH_OFFER_MINUTES ?? 30);
const BATCH_SIZE = Number(process.env.MATCH_BATCH_SIZE ?? 20);

interface WaitlistRow {
  id: string;
  patient_id: string;
  care_type: string | null;
  language: string | null;
  insurance: string | null;
}

interface PatientRow {
  id: string;
  first_name: string | null;
  phone: string | null;
  insurance_provider: string | null;
  language: string | null;
  care_type: string | null;
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

/** Reset waitlist offers that the patient never answered. */
async function expireStaleOffers(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("waitlist")
    .select("id, patient_id, offered_provider_id, offered_slot_id")
    .eq("status", "offered")
    .lt("offer_expires_at", new Date().toISOString());

  const stale = (data as Array<{
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

async function getPatient(patientId: string): Promise<PatientRow | null> {
  const { data } = await supabaseAdmin
    .from("patients")
    .select("id, first_name, phone, insurance_provider, language, care_type")
    .eq("id", patientId)
    .maybeSingle();
  return (data as PatientRow | null) ?? null;
}

/** Process one matching pass. Returns the number of new offers made. */
export async function runMatchingOnce(): Promise<number> {
  const startedAt = Date.now();
  const { data: logRow } = await supabaseAdmin
    .from("workers_log")
    .insert({ worker_name: "matching-worker", job_type: "patient_matching", status: "running" })
    .select("id")
    .maybeSingle();
  const logId = (logRow as { id: string } | null)?.id ?? null;

  let offered = 0;
  try {
    const released = await releaseExpiredHolds();
    const expired = await expireStaleOffers();

    const { data: waiting } = await supabaseAdmin
      .from("waitlist")
      .select("id, patient_id, care_type, language, insurance")
      .eq("status", "waiting")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    for (const entry of (waiting as WaitlistRow[] | null) ?? []) {
      const patient = await getPatient(entry.patient_id);
      if (!patient) continue;

      const matchInput: MatchPatient = {
        id: patient.id,
        insurance_provider: entry.insurance ?? patient.insurance_provider,
        language: entry.language ?? patient.language,
        care_type: entry.care_type ?? patient.care_type,
      };

      const match = await findBestMatchWithSlot(matchInput);
      if (!match) {
        await logMatch({ patientId: patient.id, action: "no_match" });
        continue;
      }

      // Hold the slot for the duration of the offer window.
      const held = await holdSlot(match.slot.id, patient.id, OFFER_MINUTES);
      if (!held) continue; // slot taken between match and hold; retry next pass

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
        [match.provider.first_name, match.provider.last_name].filter(Boolean).join(" ") ||
        "one of our providers";
      const message =
        `Hi ${patient.first_name ?? "there"}, we found an appointment with ` +
        `${providerName} on ${formatSlotTime(match.slot.start_time)}. ` +
        `Reply YES to confirm or NO to decline. This offer expires in ${OFFER_MINUTES} minutes.`;

      try {
        if (patient.phone) {
          await sendPatientNotification({ id: patient.id, phone: patient.phone }, message);
        }
      } catch (err) {
        console.error("[matching-worker] offer SMS failed:", err);
      }

      await logMatch({
        patientId: patient.id,
        providerId: match.provider.id,
        slotId: match.slot.id,
        score: match.score,
        action: "offered",
        details: { breakdown: match.breakdown },
      });
      offered += 1;
    }

    if (logId) {
      await supabaseAdmin
        .from("workers_log")
        .update({
          status: "completed",
          records_processed: offered,
          duration_ms: Date.now() - startedAt,
          finished_at: new Date().toISOString(),
          metadata: { released, expired, offered },
        })
        .eq("id", logId);
    }
    console.log(
      `[matching-worker] released=${released} expired=${expired} offered=${offered}`
    );
  } catch (err) {
    if (logId) {
      await supabaseAdmin
        .from("workers_log")
        .update({
          status: "failed",
          duration_ms: Date.now() - startedAt,
          finished_at: new Date().toISOString(),
          error_message: err instanceof Error ? err.message : String(err),
        })
        .eq("id", logId);
    }
    console.error("[matching-worker] run failed:", err);
  }

  return offered;
}

/** Schedule the worker to run every minute (~60s). */
export function startMatchingCron(): void {
  console.log("[matching-worker] scheduled every 60 seconds");
  cron.schedule("* * * * *", () => void runMatchingOnce());
  void runMatchingOnce();
}

// Run directly: `tsx workers/matching-worker.ts`
if (require.main === module) {
  startMatchingCron();
}
