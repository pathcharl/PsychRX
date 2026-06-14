/**
 * PsychRx Fax Worker (background / cron)
 * --------------------------------------
 * Sends daily referral-outreach faxes, respecting a configurable daily limit,
 * and logs every attempt to the `daily_send_log` table.
 *
 *   FAX_DAILY_LIMIT       max faxes per day  (default 40)
 *   FAX_RESEND_DAYS       don't re-fax the same partner within N days (default 30)
 *   OFFICE_TIMEZONE       used for the "daily" boundary + cron schedule
 *
 * Run on a schedule:  tsx workers/fax-worker.ts
 * Run a single pass:  RUN_ONCE=1 tsx workers/fax-worker.ts
 */
import cron from "node-cron";
import { supabaseAdmin } from "@/lib/supabase";
import { sendReferralFax } from "@/lib/fax";
import { APP_NAME } from "@/lib/constants";
import { withWorkerLog } from "@/workers/worker-log";

const WORKER_NAME = "fax-worker";

const OFFICE_TIMEZONE = process.env.OFFICE_TIMEZONE ?? "America/New_York";
const DAILY_LIMIT = Number(process.env.FAX_DAILY_LIMIT ?? 40);
const RESEND_DAYS = Number(process.env.FAX_RESEND_DAYS ?? 30);

const OUTREACH_CONTENT =
  `${APP_NAME} is a psychiatric practice accepting new patient referrals for ` +
  `medication management and therapy, with most major insurance plans accepted ` +
  `and fast scheduling for urgent cases. To refer a patient, simply fax this ` +
  `page back with the patient's name, date of birth, phone number, and reason ` +
  `for referral, or call our office. We will handle intake and keep you updated ` +
  `on your patient's care. Thank you for trusting us with your patients.`;

/** Today's date (YYYY-MM-DD) in the office timezone. */
function officeToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: OFFICE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

interface ReferralRow {
  id: string;
  name: string | null;
  contact_phone: string | null;
}

/** Run one outreach pass. Returns the number of faxes actually sent. */
export async function runFaxWorkerOnce(): Promise<number> {
  const today = officeToday();

  let sent = 0;
  await withWorkerLog(WORKER_NAME, async () => {
    // How many have already gone out today?
    const { count: sentToday } = await supabaseAdmin
      .from("daily_send_log")
      .select("id", { count: "exact", head: true })
      .eq("send_date", today)
      .eq("channel", "fax")
      .eq("status", "sent");

    const remaining = DAILY_LIMIT - (sentToday ?? 0);
    if (remaining <= 0) {
      console.log("[fax-worker] daily limit reached; nothing to send.");
      return { records: 0, message: "daily limit reached" };
    }

    // Partners faxed recently — skip to avoid spamming.
    const sinceDate = new Date(Date.now() - RESEND_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const { data: recent } = await supabaseAdmin
      .from("daily_send_log")
      .select("target_id")
      .eq("campaign", "referral_outreach")
      .gte("send_date", sinceDate);
    const skip = new Set(
      (recent ?? []).map((r: { target_id: string | null }) => r.target_id).filter(Boolean)
    );

    // Active referral sources with a fax/phone number.
    const { data: sources } = await supabaseAdmin
      .from("referral_sources")
      .select("id, name, contact_phone")
      .eq("status", "active")
      .not("contact_phone", "is", null)
      .order("created_at", { ascending: true })
      .limit(remaining + skip.size);

    const candidates = (sources as ReferralRow[] | null ?? [])
      .filter((s) => !skip.has(s.id))
      .slice(0, remaining);

    for (const source of candidates) {
      try {
        const result = await sendReferralFax(
          { id: source.id, name: source.name, contact_phone: source.contact_phone },
          OUTREACH_CONTENT
        );
        await supabaseAdmin.from("daily_send_log").insert({
          send_date: today,
          channel: "fax",
          campaign: "referral_outreach",
          target_type: "referral_source",
          target_id: source.id,
          to_number: result.to || source.contact_phone,
          status: result.skipped ? "skipped" : "sent",
          external_id: result.faxId,
          error_message: result.skipped ? result.reason ?? "skipped" : null,
        });
        if (!result.skipped) sent += 1;
      } catch (err) {
        await supabaseAdmin.from("daily_send_log").insert({
          send_date: today,
          channel: "fax",
          campaign: "referral_outreach",
          target_type: "referral_source",
          target_id: source.id,
          to_number: source.contact_phone,
          status: "failed",
          error_message: err instanceof Error ? err.message : String(err),
        });
        console.error("[fax-worker] send failed for", source.id, err);
      }
    }

    console.log(`[fax-worker] sent ${sent} fax(es) of ${remaining} allowed today.`);
    return {
      records: sent,
      message: `sent ${sent} fax(es) of ${remaining} allowed today`,
    };
  });

  return sent;
}

/** Schedule daily outreach at 9:00am office time. */
export function startFaxCron(): void {
  console.log(`[fax-worker] scheduled daily at 9:00am (${OFFICE_TIMEZONE})`);
  cron.schedule("0 9 * * *", () => void runFaxWorkerOnce(), {
    timezone: OFFICE_TIMEZONE,
  });
}

// Run directly: schedule, or `RUN_ONCE=1 tsx workers/fax-worker.ts` for one pass.
if (require.main === module) {
  if (process.env.RUN_ONCE) {
    void runFaxWorkerOnce().then(() => process.exit(0));
  } else {
    startFaxCron();
  }
}
