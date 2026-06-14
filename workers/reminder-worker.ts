/**
 * PsychRx Reminder Worker
 * -----------------------
 * Runs every 15 minutes and sends tiered appointment reminders via lib/sms:
 *
 *   24h reminder — tomorrow's appointments (within the next 24 hours)
 *   2h reminder  — ~2 hours before the appointment
 *   1h reminder  — ~1 hour before the appointment
 *
 * Each tier flips a boolean flag on the appointments table
 * (reminder_sent_24h / reminder_sent_2h / reminder_sent_1h) so a reminder is
 * never double-sent. Each run is recorded in worker_logs.
 */
import cron from "node-cron";
import { supabaseAdmin } from "@/lib/supabase";
import { sendAppointmentReminder, type ReminderAppointment } from "@/lib/sms";
import { withWorkerLog } from "@/workers/worker-log";

const WORKER_NAME = "reminder-worker";
const OFFICE_TIMEZONE = process.env.OFFICE_TIMEZONE ?? "America/New_York";
const ACTIVE_STATUSES = ["scheduled", "confirmed", "rescheduled"];

const SELECT =
  "id, patient_id, provider_id, scheduled_at, telehealth_url, status";

type FlagColumn = "reminder_sent_24h" | "reminder_sent_2h" | "reminder_sent_1h";

interface ApptRow {
  id: string;
  patient_id: string;
  provider_id: string;
  scheduled_at: string;
  telehealth_url: string | null;
  status: string;
}

const iso = (d: Date) => d.toISOString();
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600 * 1000);

/**
 * Load the patient + provider for an appointment with separate lookups
 * (the DB has no FK relationships registered for PostgREST joins).
 */
async function buildReminder(appt: ApptRow): Promise<ReminderAppointment> {
  const [{ data: patient }, { data: provider }] = await Promise.all([
    supabaseAdmin
      .from("patients")
      .select("id, first_name, last_name, phone")
      .eq("id", appt.patient_id)
      .maybeSingle(),
    supabaseAdmin
      .from("providers")
      .select("first_name, last_name, credentials")
      .eq("id", appt.provider_id)
      .maybeSingle(),
  ]);

  return {
    id: appt.id,
    scheduled_at: appt.scheduled_at,
    telehealth_url: appt.telehealth_url,
    patient: (patient as ReminderAppointment["patient"]) ?? null,
    provider: (provider as ReminderAppointment["provider"]) ?? null,
  };
}

interface TierResult {
  label: string;
  sent: number;
  flagged: number;
  errors: number;
}

/**
 * Generic tier runner: selects due appointments whose flag is still false,
 * sends the reminder, and sets the flag. Permanent skips (no phone) are also
 * flagged so they aren't retried forever; transient send failures are left
 * unflagged for the next run.
 */
async function runTier(
  label: string,
  flagColumn: FlagColumn,
  windowStartHours: number,
  windowEndHours: number
): Promise<TierResult> {
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select(SELECT)
    .eq(flagColumn, false)
    .in("status", ACTIVE_STATUSES)
    .gt("scheduled_at", iso(hoursFromNow(windowStartHours)))
    .lte("scheduled_at", iso(hoursFromNow(windowEndHours)));

  const result: TierResult = { label, sent: 0, flagged: 0, errors: 0 };
  if (error) {
    console.error(`[${WORKER_NAME}] ${label} query error:`, error.message);
    result.errors += 1;
    return result;
  }

  for (const appt of (data as ApptRow[] | null) ?? []) {
    try {
      const reminder = await buildReminder(appt);
      const r = await sendAppointmentReminder(reminder, { label });
      await supabaseAdmin
        .from("appointments")
        .update({ [flagColumn]: true })
        .eq("id", appt.id);
      result.flagged += 1;
      if (!r.skipped) result.sent += 1;
    } catch (err) {
      console.error(`[${WORKER_NAME}] ${label} send failed for ${appt.id}:`, err);
      result.errors += 1;
    }
  }
  return result;
}

/** Run a single pass of all reminder tiers. */
export async function runReminderWorkerOnce(): Promise<TierResult[]> {
  const results: TierResult[] = [];

  await withWorkerLog(WORKER_NAME, async () => {
    // 24h: within the next 24h but more than 2h away (the 2h tier owns the rest).
    results.push(await runTier("24hr reminder", "reminder_sent_24h", 2, 24));
    // 2h: within the next 2h but more than 1h away.
    results.push(await runTier("2hr reminder", "reminder_sent_2h", 1, 2));
    // 1h: within the next hour.
    results.push(await runTier("1hr reminder", "reminder_sent_1h", 0, 1));

    const sent = results.reduce((n, r) => n + r.sent, 0);
    const errors = results.reduce((n, r) => n + r.errors, 0);
    return {
      records: sent,
      message: results
        .map((r) => `${r.label}: sent=${r.sent}`)
        .join(", ")
        .concat(errors ? ` (errors=${errors})` : ""),
    };
  });

  return results;
}

/** Schedule the worker to run every 15 minutes. */
export function startReminderWorker(): void {
  console.log(`[${WORKER_NAME}] scheduled every 15 minutes (tz: ${OFFICE_TIMEZONE})`);
  cron.schedule("*/15 * * * *", () => void runReminderWorkerOnce(), {
    timezone: OFFICE_TIMEZONE,
  });
  void runReminderWorkerOnce();
}

// Run directly: `tsx workers/reminder-worker.ts`
if (require.main === module) {
  startReminderWorker();
}
