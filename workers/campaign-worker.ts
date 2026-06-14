/**
 * PsychRx Campaign Worker
 * -----------------------
 * Runs daily at 9am (office timezone) and sends outreach faxes to referral
 * sources and provider recruits from the outreach_contacts table.
 *
 *   * Respects FAX_DAILY_LIMIT (total faxes per calendar day)
 *   * Anti-spam: never faxes the same contact/number within FAX_RESEND_DAYS
 *   * Splits the daily budget between referral outreach and provider
 *     recruitment using the balance engine's allocation (latest
 *     platform_metrics fill rate)
 *   * Tracks every attempt in daily_send_log
 *
 * Each run is recorded in worker_logs.
 */
import cron from "node-cron";
import { supabaseAdmin } from "@/lib/supabase";
import { sendReferralFax, sendProviderRecruitFax, type FaxResult } from "@/lib/fax";
import { toE164 } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { computeFaxAllocation } from "@/workers/balance-engine";
import { withWorkerLog } from "@/workers/worker-log";

const WORKER_NAME = "campaign-worker";
const OFFICE_TIMEZONE = process.env.OFFICE_TIMEZONE ?? "America/New_York";
const FAX_DAILY_LIMIT = Number(process.env.FAX_DAILY_LIMIT ?? 40);
const FAX_RESEND_DAYS = Number(process.env.FAX_RESEND_DAYS ?? 30);

const REFERRAL_CONTENT =
  `${APP_NAME} is a psychiatric practice accepting new patient referrals for ` +
  `medication management and therapy, with most major insurance plans accepted ` +
  `and fast scheduling for urgent cases. To refer a patient, simply fax this ` +
  `page back with the patient's name, date of birth, phone number, and reason ` +
  `for referral, or call our office. We will handle intake and keep you updated ` +
  `on your patient's care. Thank you for trusting us with your patients.`;

const RECRUIT_CONTENT =
  `${APP_NAME} is growing and looking for psychiatric providers (PMHNPs, ` +
  `therapists, and psychiatrists) to join our network. We handle patient flow, ` +
  `scheduling, billing, and credentialing — you keep 75% of every session and ` +
  `set your own availability. Weekly direct deposits via Stripe. To learn more, ` +
  `fax this page back with your name and phone number, or call our office.`;

type Campaign = "referral_outreach" | "provider_recruit";

interface OutreachContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  practice_name: string | null;
  fax: string | null;
  outreach_type: string | null;
}

/** Today's date (YYYY-MM-DD) in the office timezone. */
function officeToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: OFFICE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function contactName(c: OutreachContact): string {
  return (
    [c.first_name, c.last_name].filter(Boolean).join(" ") ||
    c.practice_name ||
    ""
  );
}

/** Numbers/contacts faxed within the last FAX_RESEND_DAYS (anti-spam). */
async function loadRecentSends(): Promise<{ ids: Set<string>; numbers: Set<string> }> {
  const sinceDate = new Date(Date.now() - FAX_RESEND_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const { data } = await supabaseAdmin
    .from("daily_send_log")
    .select("target_id, to_number")
    .eq("channel", "fax")
    .in("status", ["sent", "queued"])
    .gte("send_date", sinceDate);

  const ids = new Set<string>();
  const numbers = new Set<string>();
  for (const row of (data as Array<{
    target_id: string | null;
    to_number: string | null;
  }> | null) ?? []) {
    if (row.target_id) ids.add(row.target_id);
    if (row.to_number) numbers.add(row.to_number);
  }
  return { ids, numbers };
}

/** Faxes already sent today (counts against FAX_DAILY_LIMIT). */
async function sentTodayCount(today: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("daily_send_log")
    .select("id", { count: "exact", head: true })
    .eq("send_date", today)
    .eq("channel", "fax")
    .eq("status", "sent");
  return count ?? 0;
}

/** Eligible contacts for one campaign, excluding recently-faxed ones. */
async function loadCandidates(
  campaign: Campaign,
  recent: { ids: Set<string>; numbers: Set<string> },
  limit: number
): Promise<OutreachContact[]> {
  if (limit <= 0) return [];
  const types =
    campaign === "referral_outreach"
      ? ["referral_source", "both"]
      : ["provider_recruit", "both"];

  const { data } = await supabaseAdmin
    .from("outreach_contacts")
    .select("id, first_name, last_name, practice_name, fax, outreach_type")
    .in("outreach_type", types)
    .not("fax", "is", null)
    .not("contact_status", "in", "(responded,signed_up,rendering)")
    .order("tier", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit + recent.ids.size);

  return ((data as OutreachContact[] | null) ?? [])
    .filter((c) => {
      const e164 = toE164(c.fax);
      return !recent.ids.has(c.id) && (!e164 || !recent.numbers.has(e164));
    })
    .slice(0, limit);
}

/** Fax one contact and record the attempt in daily_send_log. Returns true if sent. */
async function faxContact(
  contact: OutreachContact,
  campaign: Campaign,
  today: string
): Promise<boolean> {
  const faxContactInfo = { id: contact.id, name: contactName(contact), fax: contact.fax };
  let result: FaxResult | null = null;
  let errorMessage: string | null = null;

  try {
    result =
      campaign === "referral_outreach"
        ? await sendReferralFax(faxContactInfo, REFERRAL_CONTENT)
        : await sendProviderRecruitFax(faxContactInfo, RECRUIT_CONTENT);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[${WORKER_NAME}] fax failed for contact ${contact.id}:`, err);
  }

  const sent = Boolean(result && !result.skipped);
  await supabaseAdmin.from("daily_send_log").insert({
    send_date: today,
    channel: "fax",
    campaign,
    target_type: campaign === "referral_outreach" ? "referral_source" : "provider",
    target_id: contact.id,
    to_number: result?.to || toE164(contact.fax) || contact.fax,
    status: errorMessage ? "failed" : sent ? "sent" : "skipped",
    external_id: result?.faxId ?? null,
    error_message: errorMessage ?? (result?.skipped ? result.reason ?? "skipped" : null),
  });

  if (sent) {
    await supabaseAdmin
      .from("outreach_contacts")
      .update({ contact_status: "faxed", fax_sent_at: new Date().toISOString() })
      .eq("id", contact.id);
  }
  return sent;
}

/** Run one outreach pass. Returns the number of faxes actually sent. */
export async function runCampaignWorkerOnce(): Promise<number> {
  let totalSent = 0;

  await withWorkerLog(WORKER_NAME, async () => {
    const today = officeToday();
    const alreadySent = await sentTodayCount(today);
    const budget = FAX_DAILY_LIMIT - alreadySent;
    if (budget <= 0) {
      return {
        records: 0,
        message: `daily limit of ${FAX_DAILY_LIMIT} reached (${alreadySent} sent today)`,
      };
    }

    // Split today's budget using the balance engine's latest decision.
    const { data: metrics } = await supabaseAdmin
      .from("platform_metrics")
      .select("fill_rate")
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const fillRate = (metrics as { fill_rate: number | null } | null)?.fill_rate ?? null;
    const allocation = computeFaxAllocation(fillRate === null ? null : Number(fillRate));
    const referralBudget = Math.round(budget * allocation.referral);
    const recruitBudget = budget - referralBudget;

    const recent = await loadRecentSends();
    let referralSent = 0;
    let recruitSent = 0;

    for (const contact of await loadCandidates("referral_outreach", recent, referralBudget)) {
      if (await faxContact(contact, "referral_outreach", today)) referralSent += 1;
    }
    for (const contact of await loadCandidates("provider_recruit", recent, recruitBudget)) {
      if (await faxContact(contact, "provider_recruit", today)) recruitSent += 1;
    }

    totalSent = referralSent + recruitSent;
    return {
      records: totalSent,
      message:
        `sent ${totalSent}/${budget} fax(es) — referral=${referralSent} ` +
        `recruit=${recruitSent} (allocation ${Math.round(allocation.referral * 100)}/` +
        `${Math.round(allocation.recruit * 100)}, fill_rate=${fillRate ?? "n/a"})`,
    };
  });

  return totalSent;
}

/** Schedule daily outreach at 9:00am office time. */
export function startCampaignWorker(): void {
  console.log(`[${WORKER_NAME}] scheduled daily at 09:00 (${OFFICE_TIMEZONE})`);
  cron.schedule("0 9 * * *", () => void runCampaignWorkerOnce(), {
    timezone: OFFICE_TIMEZONE,
  });
}

// Run directly: schedule, or `RUN_ONCE=1 tsx workers/campaign-worker.ts` for one pass.
if (require.main === module) {
  if (process.env.RUN_ONCE) {
    void runCampaignWorkerOnce().then(() => process.exit(0));
  } else {
    startCampaignWorker();
  }
}
