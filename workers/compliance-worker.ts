/**
 * PsychRx Compliance Worker
 * -------------------------
 * Runs daily at 6am (office timezone) and checks every active provider for:
 *
 *   * License expiry      — warn 60 days before, SUSPEND if expired
 *   * Malpractice expiry  — warn 90 days before, SUSPEND if expired
 *   * DEA expiry          — warn 90 days before, SUSPEND if expired
 *   * CAQH attestation    — warn if not attested in the last 90 days
 *
 * Warnings go by SMS to the provider AND to Patrick (OWNER_PHONE).
 * All checks are logged to worker_logs.
 */
import cron from "node-cron";
import { supabaseAdmin } from "@/lib/supabase";
import { sendProviderAlert, sendSms } from "@/lib/sms";
import { withWorkerLog } from "@/workers/worker-log";

const WORKER_NAME = "compliance-worker";
const OFFICE_TIMEZONE = process.env.OFFICE_TIMEZONE ?? "America/New_York";
const OWNER_PHONE = process.env.OWNER_PHONE ?? "";

const LICENSE_WARN_DAYS = Number(process.env.LICENSE_WARN_DAYS ?? 60);
const MALPRACTICE_WARN_DAYS = Number(process.env.MALPRACTICE_WARN_DAYS ?? 90);
const DEA_WARN_DAYS = Number(process.env.DEA_WARN_DAYS ?? 90);
const CAQH_STALE_DAYS = Number(process.env.CAQH_STALE_DAYS ?? 90);

interface ProviderRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: string;
  license_expiry: string | null;
  malpractice_expiry: string | null;
  dea_expiry: string | null;
  caqh_last_attested: string | null;
}

function providerName(p: ProviderRow): string {
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Provider";
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function daysSince(dateStr: string | null): number | null {
  const until = daysUntil(dateStr);
  return until === null ? null : -until;
}

/** SMS the provider and Patrick. Send failures never abort the run. */
async function warnProviderAndOwner(
  provider: ProviderRow,
  providerMessage: string,
  ownerMessage: string
): Promise<void> {
  if (provider.phone) {
    await sendProviderAlert(provider, providerMessage).catch((err) =>
      console.error(`[${WORKER_NAME}] provider SMS failed:`, err)
    );
  }
  if (OWNER_PHONE) {
    await sendSms(OWNER_PHONE, ownerMessage, {
      recipientType: "owner",
      subject: "Compliance alert",
    }).catch((err) => console.error(`[${WORKER_NAME}] owner SMS failed:`, err));
  }
}

async function suspendProvider(provider: ProviderRow, reason: string): Promise<void> {
  // Suspension = inactive + not accepting new patients (the providers table
  // has no compliance_suspended/available columns).
  await supabaseAdmin
    .from("providers")
    .update({
      status: "inactive",
      accepts_new_patients: false,
    })
    .eq("id", provider.id);

  await warnProviderAndOwner(
    provider,
    `Important: your PsychRx provider account has been SUSPENDED (${reason}). ` +
      `Please contact the office to resolve this credential issue.`,
    `COMPLIANCE: ${providerName(provider)} was suspended — ${reason}.`
  );
}

interface CredentialCheck {
  credential: string;
  expiry: string | null;
  warnDays: number;
}

interface CheckOutcome {
  provider_id: string;
  credential: string;
  outcome: "ok" | "warned" | "suspended";
  detail: string;
}

/** Check all credentials for one provider. Returns one outcome per check. */
async function checkProvider(provider: ProviderRow): Promise<CheckOutcome[]> {
  const outcomes: CheckOutcome[] = [];
  let suspended = false;

  const credentials: CredentialCheck[] = [
    {
      credential: "license",
      expiry: provider.license_expiry,
      warnDays: LICENSE_WARN_DAYS,
    },
    {
      credential: "malpractice",
      expiry: provider.malpractice_expiry,
      warnDays: MALPRACTICE_WARN_DAYS,
    },
    {
      credential: "DEA",
      expiry: provider.dea_expiry,
      warnDays: DEA_WARN_DAYS,
    },
  ];

  for (const { credential, expiry, warnDays } of credentials) {
    const days = daysUntil(expiry);
    if (days === null) {
      outcomes.push({
        provider_id: provider.id,
        credential,
        outcome: "ok",
        detail: "no expiry date on file",
      });
      continue;
    }

    if (days < 0) {
      if (!suspended) {
        await suspendProvider(provider, `expired ${credential} (${expiry})`);
        suspended = true;
      }
      outcomes.push({
        provider_id: provider.id,
        credential,
        outcome: "suspended",
        detail: `expired ${-days} day(s) ago (${expiry})`,
      });
    } else if (days <= warnDays) {
      await warnProviderAndOwner(
        provider,
        `Reminder: your ${credential} expires in ${days} day(s) (${expiry}). ` +
          `Please renew to stay active on PsychRx.`,
        `COMPLIANCE: ${providerName(provider)}'s ${credential} expires in ${days} day(s) (${expiry}).`
      );
      outcomes.push({
        provider_id: provider.id,
        credential,
        outcome: "warned",
        detail: `expires in ${days} day(s) (${expiry})`,
      });
    } else {
      outcomes.push({
        provider_id: provider.id,
        credential,
        outcome: "ok",
        detail: `expires in ${days} day(s)`,
      });
    }
  }

  // CAQH attestation: warn if last attestation was more than 90 days ago
  // (or never recorded). No suspension — warning only.
  const sinceAttested = daysSince(provider.caqh_last_attested);
  if (sinceAttested === null || sinceAttested > CAQH_STALE_DAYS) {
    const detail =
      sinceAttested === null
        ? "no attestation on file"
        : `last attested ${sinceAttested} day(s) ago`;
    await warnProviderAndOwner(
      provider,
      `Reminder: your CAQH profile needs re-attestation (${detail}). ` +
        `Please log in to CAQH ProView and attest.`,
      `COMPLIANCE: ${providerName(provider)} needs CAQH re-attestation (${detail}).`
    );
    outcomes.push({
      provider_id: provider.id,
      credential: "CAQH attestation",
      outcome: "warned",
      detail,
    });
  } else {
    outcomes.push({
      provider_id: provider.id,
      credential: "CAQH attestation",
      outcome: "ok",
      detail: `attested ${sinceAttested} day(s) ago`,
    });
  }

  return outcomes;
}

/** Run one compliance pass over all active providers. */
export async function runComplianceWorkerOnce(): Promise<number> {
  let actions = 0;

  await withWorkerLog(WORKER_NAME, async () => {
    const { data: providers } = await supabaseAdmin
      .from("providers")
      .select(
        "id, first_name, last_name, phone, status, " +
          "license_expiry, malpractice_expiry, dea_expiry, caqh_last_attested"
      )
      .eq("status", "active");

    const all: CheckOutcome[] = [];
    for (const provider of (providers as ProviderRow[] | null) ?? []) {
      all.push(...(await checkProvider(provider)));
    }

    const warned = all.filter((o) => o.outcome === "warned").length;
    const suspendedCount = new Set(
      all.filter((o) => o.outcome === "suspended").map((o) => o.provider_id)
    ).size;
    actions = warned + suspendedCount;

    return {
      records: all.length,
      message:
        `checked ${providers?.length ?? 0} provider(s): ${all.length} credential ` +
        `check(s), ${warned} warning(s), ${suspendedCount} suspension(s)`,
    };
  });

  return actions;
}

/** Schedule daily compliance checks at 6:00am office time. */
export function startComplianceWorker(): void {
  console.log(`[${WORKER_NAME}] scheduled daily at 06:00 (${OFFICE_TIMEZONE})`);
  cron.schedule("0 6 * * *", () => void runComplianceWorkerOnce(), {
    timezone: OFFICE_TIMEZONE,
  });
}

// Run directly: schedule, or `RUN_ONCE=1 tsx workers/compliance-worker.ts` for one pass.
if (require.main === module) {
  if (process.env.RUN_ONCE) {
    void runComplianceWorkerOnce().then(() => process.exit(0));
  } else {
    startComplianceWorker();
  }
}
