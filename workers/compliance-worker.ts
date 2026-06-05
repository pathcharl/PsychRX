/**
 * PsychRx Compliance Worker
 * -------------------------
 * Runs daily at 6am (office timezone):
 *   * warns providers 60 days before license expiry
 *   * warns 90 days before malpractice / DEA expiry
 *   * monthly OIG exclusion check (1st of month)
 *   * suspends providers with expired credentials or OIG hits
 *   * logs all checks to audit_log
 */
import cron from "node-cron";
import { format } from "date-fns";
import { supabaseAdmin } from "@/lib/supabase";
import { sendProviderAlert } from "@/lib/sms";

const OFFICE_TIMEZONE = process.env.OFFICE_TIMEZONE ?? "America/New_York";
const LICENSE_WARN_DAYS = Number(process.env.LICENSE_WARN_DAYS ?? 60);
const MALPRACTICE_WARN_DAYS = Number(process.env.MALPRACTICE_WARN_DAYS ?? 90);
const DEA_WARN_DAYS = Number(process.env.DEA_WARN_DAYS ?? 90);

interface ProviderRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  npi: string | null;
  license_expires_at: string | null;
  malpractice_expires_at: string | null;
  dea_expires_at: string | null;
  oig_excluded: boolean | null;
  status: string;
}

async function logAudit(
  action: string,
  entityId: string | null,
  changes: Record<string, unknown>
): Promise<void> {
  await supabaseAdmin.from("audit_log").insert({
    action: "other",
    entity_type: "providers",
    entity_id: entityId,
    changes: { check: action, ...changes },
  });
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

async function suspendProvider(
  provider: ProviderRow,
  reason: string
): Promise<void> {
  await supabaseAdmin
    .from("providers")
    .update({
      status: "inactive",
      compliance_suspended: true,
      available: false,
      unavailable_reason: reason,
      unavailable_since: new Date().toISOString(),
    })
    .eq("id", provider.id);

  await logAudit("suspend", provider.id, { reason });

  if (provider.phone) {
    await sendProviderAlert(
      provider,
      `Important: your PsychRx provider account has been suspended (${reason}). ` +
        `Please contact the office to resolve credential issues.`
    ).catch(() => undefined);
  }
}

/** Check a provider's credential expiry dates; warn or suspend as needed. */
async function checkProviderCredentials(provider: ProviderRow): Promise<number> {
  let actions = 0;

  const licenseDays = daysUntil(provider.license_expires_at);
  if (licenseDays !== null) {
    if (licenseDays < 0) {
      await suspendProvider(provider, "expired license");
      actions += 1;
    } else if (licenseDays <= LICENSE_WARN_DAYS) {
      await logAudit("license_expiry_warning", provider.id, {
        days_remaining: licenseDays,
        expires_at: provider.license_expires_at,
      });
      await sendProviderAlert(
        provider,
        `Reminder: your medical license expires in ${licenseDays} day(s) ` +
          `(${provider.license_expires_at}). Please renew to stay active on PsychRx.`
      ).catch(() => undefined);
      actions += 1;
    }
  }

  const malDays = daysUntil(provider.malpractice_expires_at);
  if (malDays !== null) {
    if (malDays < 0) {
      await suspendProvider(provider, "expired malpractice insurance");
      actions += 1;
    } else if (malDays <= MALPRACTICE_WARN_DAYS) {
      await logAudit("malpractice_expiry_warning", provider.id, {
        days_remaining: malDays,
        expires_at: provider.malpractice_expires_at,
      });
      await sendProviderAlert(
        provider,
        `Reminder: your malpractice insurance expires in ${malDays} day(s). ` +
          `Please update your coverage with PsychRx.`
      ).catch(() => undefined);
      actions += 1;
    }
  }

  const deaDays = daysUntil(provider.dea_expires_at);
  if (deaDays !== null) {
    if (deaDays < 0) {
      await suspendProvider(provider, "expired DEA registration");
      actions += 1;
    } else if (deaDays <= DEA_WARN_DAYS) {
      await logAudit("dea_expiry_warning", provider.id, {
        days_remaining: deaDays,
        expires_at: provider.dea_expires_at,
      });
      await sendProviderAlert(
        provider,
        `Reminder: your DEA registration expires in ${deaDays} day(s). Renew to continue prescribing.`
      ).catch(() => undefined);
      actions += 1;
    }
  }

  if (provider.oig_excluded) {
    await suspendProvider(provider, "OIG exclusion list match");
    actions += 1;
  }

  await supabaseAdmin
    .from("providers")
    .update({ oig_checked_at: new Date().toISOString() })
    .eq("id", provider.id);

  return actions;
}

/** Monthly OIG exclusion check against the local oig_exclusions table. */
async function runOigCheck(): Promise<number> {
  let hits = 0;

  const { data: providers } = await supabaseAdmin
    .from("providers")
    .select("id, npi, first_name, last_name, phone, oig_excluded, status")
    .neq("npi", null);

  for (const p of (providers as ProviderRow[] | null) ?? []) {
    if (!p.npi) continue;

    const { data: hit } = await supabaseAdmin
      .from("oig_exclusions")
      .select("id, reason")
      .eq("npi", p.npi)
      .maybeSingle();

    if (hit) {
      hits += 1;
      await supabaseAdmin
        .from("providers")
        .update({ oig_excluded: true })
        .eq("id", p.id);

      await logAudit("oig_exclusion_match", p.id, {
        npi: p.npi,
        reason: (hit as { reason?: string }).reason ?? null,
      });

      await suspendProvider(p, "OIG exclusion list match");
    }
  }

  await logAudit("oig_monthly_scan", null, {
    providers_checked: providers?.length ?? 0,
    hits,
    scanned_at: new Date().toISOString(),
  });

  return hits;
}

/** Run one compliance pass. Returns total actions taken. */
export async function runComplianceWorkerOnce(forceOig = false): Promise<number> {
  const startedAt = Date.now();
  const today = new Date();
  const isFirstOfMonth = today.getDate() === 1;
  const runOig = forceOig || isFirstOfMonth;

  const { data: logRow } = await supabaseAdmin
    .from("workers_log")
    .insert({ worker_name: "compliance-worker", job_type: "credential_check", status: "running" })
    .select("id")
    .maybeSingle();
  const logId = (logRow as { id: string } | null)?.id ?? null;

  let actions = 0;
  try {
    const { data: providers } = await supabaseAdmin
      .from("providers")
      .select(
        "id, first_name, last_name, phone, npi, license_expires_at, malpractice_expires_at, dea_expires_at, oig_excluded, status"
      )
      .in("status", ["active", "pending"]);

    for (const provider of (providers as ProviderRow[] | null) ?? []) {
      actions += await checkProviderCredentials(provider);
    }

    if (runOig) {
      actions += await runOigCheck();
    }

    await logAudit("compliance_daily_run", null, {
      providers_checked: providers?.length ?? 0,
      actions,
      oig_scan: runOig,
      date: format(today, "yyyy-MM-dd"),
    });

    if (logId) {
      await supabaseAdmin
        .from("workers_log")
        .update({
          status: "completed",
          records_processed: actions,
          duration_ms: Date.now() - startedAt,
          finished_at: new Date().toISOString(),
          metadata: { oig_scan: runOig },
        })
        .eq("id", logId);
    }
    console.log(`[compliance-worker] ${actions} action(s); OIG scan=${runOig}.`);
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
    console.error("[compliance-worker] run failed:", err);
  }

  return actions;
}

/** Schedule daily compliance checks at 6:00am office time. */
export function startComplianceCron(): void {
  console.log(`[compliance-worker] scheduled daily at 06:00 (${OFFICE_TIMEZONE})`);
  cron.schedule("0 6 * * *", () => void runComplianceWorkerOnce(), {
    timezone: OFFICE_TIMEZONE,
  });
}

if (require.main === module) {
  if (process.env.RUN_ONCE) {
    void runComplianceWorkerOnce(process.env.FORCE_OIG === "1").then(() =>
      process.exit(0)
    );
  } else {
    startComplianceCron();
  }
}
