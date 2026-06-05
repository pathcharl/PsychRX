/**
 * PsychRx Reminder Worker (cron)
 * ------------------------------
 * Runs every 15 minutes and sends tiered appointment reminders:
 *
 *   24h reminder      — sent once an appointment is within 24 hours
 *   morning reminder  — sent at 8am (office tz) for that day's appointments
 *   2h reminder       — sent ~2 hours before the appointment
 *   1h reminder       — sent ~1 hour before the appointment
 *
 * Each tier writes a timestamp flag on the appointment so it never double-sends.
 * All DB access uses supabaseAdmin; reminders go out via lib/sms.
 */
import cron from "node-cron";
import { supabaseAdmin } from "@/lib/supabase";
import { sendAppointmentReminder, type ReminderAppointment } from "@/lib/sms";

const OFFICE_TIMEZONE = process.env.OFFICE_TIMEZONE ?? "America/New_York";
const ACTIVE_STATUSES = ["scheduled", "confirmed", "rescheduled"];

// Typed as `string` (not a string literal) so the Supabase client doesn't try
// to statically parse the embedded-resource select and blow the type depth.
const SELECT: string = `
  id, scheduled_start, appointment_type, location, telehealth_link, status,
  patient:patients ( id, first_name, last_name, phone ),
  provider:providers ( first_name, last_name, credentials )
`;

type FlagColumn =
  | "reminder_24h_sent_at"
  | "reminder_morning_sent_at"
  | "reminder_2h_sent_at"
  | "reminder_1h_sent_at";

const iso = (d: Date) => d.toISOString();
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600 * 1000);

/** Current wall-clock parts in the office timezone. */
function localParts(): { hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: OFFICE_TIMEZONE,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? "0");
  let hour = get("hour");
  if (hour === 24) hour = 0;
  return { hour, minute: get("minute"), second: get("second") };
}

/** End-of-day instant (office tz) expressed as a UTC Date. */
function endOfLocalDay(): Date {
  const { hour, minute, second } = localParts();
  const secondsLeft = (23 - hour) * 3600 + (59 - minute) * 60 + (60 - second);
  return new Date(Date.now() + secondsLeft * 1000);
}

interface TierResult {
  label: string;
  sent: number;
  flagged: number;
  errors: number;
}

/**
 * Generic tier runner: selects due appointments missing the flag, sends a
 * reminder, and stamps the flag. On a hard error (no phone) it still stamps
 * the flag to avoid retrying forever; transient send failures are left unflagged.
 */
type AppointmentQuery = {
  lte: (col: string, v: string) => AppointmentQuery;
  gt: (col: string, v: string) => AppointmentQuery;
  then: Promise<unknown>["then"];
};

async function runTier(
  label: string,
  flagColumn: FlagColumn,
  applyWindow: (q: AppointmentQuery) => AppointmentQuery
): Promise<TierResult> {
  const base = supabaseAdmin
    .from("appointments")
    .select(SELECT)
    .is(flagColumn, null)
    .in("status", ACTIVE_STATUSES) as unknown as AppointmentQuery;

  const { data, error } = (await applyWindow(base)) as unknown as {
    data: ReminderAppointment[] | null;
    error: { message: string } | null;
  };

  const result: TierResult = { label, sent: 0, flagged: 0, errors: 0 };
  if (error) {
    console.error(`[reminder-worker] ${label} query error:`, error.message);
    result.errors += 1;
    return result;
  }

  for (const appt of data ?? []) {
    try {
      const r = await sendAppointmentReminder(appt, { label });
      // Stamp the flag on success OR permanent skip (missing phone).
      await supabaseAdmin
        .from("appointments")
        .update({ [flagColumn]: new Date().toISOString() })
        .eq("id", appt.id);
      result.flagged += 1;
      if (!r.skipped) result.sent += 1;
    } catch (err) {
      // Transient failure: leave the flag null so the next run retries.
      console.error(
        `[reminder-worker] ${label} send failed for ${appt.id}:`,
        err
      );
      result.errors += 1;
    }
  }
  return result;
}

/** Run a single pass of all reminder tiers. */
export async function runReminderWorker(): Promise<TierResult[]> {
  const startedAt = Date.now();
  const { data: logRow } = await supabaseAdmin
    .from("workers_log")
    .insert({
      worker_name: "reminder-worker",
      job_type: "appointment_reminders",
      status: "running",
    })
    .select("id")
    .maybeSingle();
  const logId = (logRow as { id: string } | null)?.id ?? null;

  const results: TierResult[] = [];

  try {
    // 24h: within the next 24h but more than 2h away (the 2h tier owns the rest).
    results.push(
      await runTier("24h reminder", "reminder_24h_sent_at", (q) =>
        q
          .lte("scheduled_start", iso(hoursFromNow(24)))
          .gt("scheduled_start", iso(hoursFromNow(2)))
      )
    );

    // Morning: only at 8am office time, for the remainder of today.
    if (localParts().hour === 8) {
      results.push(
        await runTier("Today's appointment", "reminder_morning_sent_at", (q) =>
          q
            .gt("scheduled_start", iso(new Date()))
            .lte("scheduled_start", iso(endOfLocalDay()))
        )
      );
    }

    // 2h: within the next 2h but more than 1h away.
    results.push(
      await runTier("2h reminder", "reminder_2h_sent_at", (q) =>
        q
          .lte("scheduled_start", iso(hoursFromNow(2)))
          .gt("scheduled_start", iso(hoursFromNow(1)))
      )
    );

    // 1h: within the next hour.
    results.push(
      await runTier("1h reminder", "reminder_1h_sent_at", (q) =>
        q
          .lte("scheduled_start", iso(hoursFromNow(1)))
          .gt("scheduled_start", iso(new Date()))
      )
    );

    const totalSent = results.reduce((n, r) => n + r.sent, 0);
    if (logId) {
      await supabaseAdmin
        .from("workers_log")
        .update({
          status: "completed",
          records_processed: totalSent,
          duration_ms: Date.now() - startedAt,
          finished_at: new Date().toISOString(),
          metadata: { tiers: results },
        })
        .eq("id", logId);
    }
    console.log("[reminder-worker] run complete:", JSON.stringify(results));
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
    console.error("[reminder-worker] run failed:", err);
  }

  return results;
}

/** Schedule the worker to run every 15 minutes. */
export function startReminderCron(): void {
  console.log(
    `[reminder-worker] scheduled every 15 minutes (tz: ${OFFICE_TIMEZONE})`
  );
  cron.schedule("*/15 * * * *", () => void runReminderWorker(), {
    timezone: OFFICE_TIMEZONE,
  });
  // Run once immediately on startup.
  void runReminderWorker();
}

// Run directly: `tsx workers/reminder-worker.ts`
if (require.main === module) {
  startReminderCron();
}
