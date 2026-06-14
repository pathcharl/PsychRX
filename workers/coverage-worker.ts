/**
 * PsychRx Coverage Worker
 * -----------------------
 * Runs every 2 hours. For every provider who reported out sick (via the SMS
 * SICK command), it:
 *
 *   1. finds their upcoming affected appointments (next 48 hours)
 *   2. looks for an available coverage provider with a matching specialty
 *   3. reassigns the appointment to the coverage provider when one exists,
 *      or cancels + re-queues the patient on the waitlist for rescheduling
 *   4. notifies the affected patient by SMS either way
 *
 * Coverage assignments are tracked on the provider_absences row.
 * Each run is recorded in worker_logs.
 */
import cron from "node-cron";
import { supabaseAdmin } from "@/lib/supabase";
import { sendPatientNotification } from "@/lib/sms";
import { withWorkerLog } from "@/workers/worker-log";

const WORKER_NAME = "coverage-worker";
const OFFICE_TIMEZONE = process.env.OFFICE_TIMEZONE ?? "America/New_York";
/** How far ahead to look for appointments needing coverage. */
const COVERAGE_HORIZON_HOURS = Number(process.env.COVERAGE_HORIZON_HOURS ?? 48);
const ACTIVE_STATUSES = ["scheduled", "confirmed", "rescheduled"];

interface SickProvider {
  id: string;
  first_name: string | null;
  last_name: string | null;
  specialties: string[] | null;
}

interface AppointmentRow {
  id: string;
  patient_id: string;
  scheduled_at: string;
}

interface CoverageCandidate {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

function fullName(p: { first_name: string | null; last_name: string | null }): string {
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "your provider";
}

function formatApptTime(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: OFFICE_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/**
 * Providers currently out sick: read from provider_absences (the SMS router's
 * SICK handler opens an active 'sick' absence row; the providers table has no
 * available/unavailable_reason columns).
 */
async function findSickProviders(): Promise<SickProvider[]> {
  const { data: absences } = await supabaseAdmin
    .from("provider_absences")
    .select("provider_id")
    .eq("absence_type", "sick")
    .eq("status", "active");

  const ids = Array.from(
    new Set(
      ((absences as Array<{ provider_id: string | null }> | null) ?? [])
        .map((a) => a.provider_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  if (!ids.length) return [];

  const { data } = await supabaseAdmin
    .from("providers")
    .select("id, first_name, last_name, specialties")
    .in("id", ids);
  return (data as SickProvider[] | null) ?? [];
}

/**
 * Best coverage provider for a sick provider's appointment: active, matching
 * specialty, no appointment at the same time.
 */
async function findCoverageProvider(
  sick: SickProvider,
  appt: AppointmentRow
): Promise<CoverageCandidate | null> {
  let query = supabaseAdmin
    .from("providers")
    .select("id, first_name, last_name")
    .eq("status", "active")
    .neq("id", sick.id);
  if (sick.specialties?.length) {
    query = query.overlaps("specialties", sick.specialties);
  }

  const { data } = await query;
  const candidates = (data as CoverageCandidate[] | null) ?? [];

  for (const candidate of candidates) {
    // Skip candidates already booked at this time.
    const { count } = await supabaseAdmin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", candidate.id)
      .eq("scheduled_at", appt.scheduled_at)
      .in("status", ACTIVE_STATUSES);
    if (!count) return candidate;
  }
  return null;
}

async function getPatient(patientId: string) {
  const { data } = await supabaseAdmin
    .from("patients")
    .select("id, first_name, last_name, phone")
    .eq("id", patientId)
    .maybeSingle();
  return data ?? null;
}

/** Reassign one appointment to a coverage provider and notify the patient. */
async function reassignAppointment(
  appt: AppointmentRow,
  sick: SickProvider,
  coverage: CoverageCandidate
): Promise<void> {
  // No notes column on appointments — the reassignment itself is the record.
  await supabaseAdmin
    .from("appointments")
    .update({ provider_id: coverage.id })
    .eq("id", appt.id);

  const patient = await getPatient(appt.patient_id);
  if (patient) {
    await sendPatientNotification(
      patient,
      `Hi ${patient.first_name ?? "there"}, ${fullName(sick)} is unavailable for ` +
        `your appointment on ${formatApptTime(appt.scheduled_at)}. ` +
        `You'll be seen by ${fullName(coverage)} at the same time. ` +
        `Reply CANCEL if that doesn't work for you.`
    );
  }
}

/** No coverage found: cancel and re-queue the patient for rescheduling. */
async function rescheduleAppointment(
  appt: AppointmentRow,
  sick: SickProvider
): Promise<void> {
  await supabaseAdmin
    .from("appointments")
    .update({
      status: "cancelled",
      cancellation_reason: "Provider out sick — no coverage available",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", appt.id);

  // High-priority waitlist entry so the matching worker re-offers quickly.
  await supabaseAdmin.from("waitlist").insert({
    patient_id: appt.patient_id,
    status: "waiting",
    reason: "Rescheduling: provider out sick",
    source: "coverage-worker",
    priority: 10,
  });

  const patient = await getPatient(appt.patient_id);
  if (patient) {
    await sendPatientNotification(
      patient,
      `Hi ${patient.first_name ?? "there"}, we're sorry — ${fullName(sick)} is out ` +
        `sick and your appointment on ${formatApptTime(appt.scheduled_at)} ` +
        `needs to be rescheduled. We'll text you new appointment options shortly.`
    );
  }
}

/** Record which coverage providers handled an absence. */
async function trackCoverage(
  providerId: string,
  coverageIds: string[],
  affectedIds: string[]
): Promise<void> {
  if (!coverageIds.length && !affectedIds.length) return;
  const { data } = await supabaseAdmin
    .from("provider_absences")
    .select("id, coverage_provider_ids, affected_appointment_ids")
    .eq("provider_id", providerId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const absence = data as {
    id: string;
    coverage_provider_ids: string[] | null;
    affected_appointment_ids: string[] | null;
  } | null;
  if (!absence) return;

  await supabaseAdmin
    .from("provider_absences")
    .update({
      coverage_provider_ids: Array.from(
        new Set([...(absence.coverage_provider_ids ?? []), ...coverageIds])
      ),
      affected_appointment_ids: Array.from(
        new Set([...(absence.affected_appointment_ids ?? []), ...affectedIds])
      ),
    })
    .eq("id", absence.id);
}

/** Run one coverage pass. Returns the number of appointments handled. */
export async function runCoverageWorkerOnce(): Promise<number> {
  let handled = 0;

  await withWorkerLog(WORKER_NAME, async () => {
    const sickProviders = await findSickProviders();
    let reassigned = 0;
    let rescheduled = 0;

    for (const sick of sickProviders) {
      const horizon = new Date(
        Date.now() + COVERAGE_HORIZON_HOURS * 3600 * 1000
      ).toISOString();
      const { data: appts } = await supabaseAdmin
        .from("appointments")
        .select("id, patient_id, scheduled_at")
        .eq("provider_id", sick.id)
        .gte("scheduled_at", new Date().toISOString())
        .lte("scheduled_at", horizon)
        .in("status", ACTIVE_STATUSES)
        .order("scheduled_at", { ascending: true });

      const coverageIds: string[] = [];
      const affectedIds: string[] = [];

      for (const appt of (appts as AppointmentRow[] | null) ?? []) {
        affectedIds.push(appt.id);
        try {
          const coverage = await findCoverageProvider(sick, appt);
          if (coverage) {
            await reassignAppointment(appt, sick, coverage);
            coverageIds.push(coverage.id);
            reassigned += 1;
          } else {
            await rescheduleAppointment(appt, sick);
            rescheduled += 1;
          }
          handled += 1;
        } catch (err) {
          console.error(`[${WORKER_NAME}] failed to cover appointment ${appt.id}:`, err);
        }
      }

      await trackCoverage(sick.id, coverageIds, affectedIds);
    }

    return {
      records: handled,
      message:
        `sick providers=${sickProviders.length} ` +
        `reassigned=${reassigned} rescheduled=${rescheduled}`,
    };
  });

  return handled;
}

/** Schedule the worker to run every 2 hours. */
export function startCoverageWorker(): void {
  console.log(`[${WORKER_NAME}] scheduled every 2 hours`);
  cron.schedule("0 */2 * * *", () => void runCoverageWorkerOnce());
  void runCoverageWorkerOnce();
}

// Run directly: schedule, or `RUN_ONCE=1 tsx workers/coverage-worker.ts` for one pass.
if (require.main === module) {
  if (process.env.RUN_ONCE) {
    void runCoverageWorkerOnce().then(() => process.exit(0));
  } else {
    startCoverageWorker();
  }
}
