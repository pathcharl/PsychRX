/**
 * PsychRx No-Show Worker
 * ----------------------
 * Runs every 15 minutes and:
 *   1. finds appointments that started 15+ minutes ago with no check-in
 *   2. marks them no_show
 *   3. charges the $150 no-show fee if the patient has a card on file
 *   4. transfers the provider's 75% share
 *   5. records the fee in no_show_fees and notifies the provider
 */
import cron from "node-cron";
import { supabaseAdmin } from "@/lib/supabase";
import {
  createNoShowCharge,
  transferToProvider,
  computeSplit,
  NO_SHOW_FEE_CENTS,
} from "@/lib/stripe";
import { sendProviderAlert } from "@/lib/sms";

const GRACE_MINUTES = Number(process.env.NO_SHOW_GRACE_MINUTES ?? 15);
const toDollars = (cents: number) => Math.round(cents) / 100;

interface ApptRow {
  id: string;
  patient_id: string;
  provider_id: string;
  scheduled_start: string;
}

interface PatientRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  stripe_customer_id: string | null;
}

interface ProviderRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  stripe_account_id: string | null;
  stripe_payouts_enabled: boolean | null;
}

/** Run one no-show detection pass. Returns the number of no-shows processed. */
export async function runNoShowWorkerOnce(): Promise<number> {
  const startedAt = Date.now();
  const cutoff = new Date(Date.now() - GRACE_MINUTES * 60_000).toISOString();

  const { data: logRow } = await supabaseAdmin
    .from("workers_log")
    .insert({ worker_name: "noshow-worker", job_type: "no_show_fees", status: "running" })
    .select("id")
    .maybeSingle();
  const logId = (logRow as { id: string } | null)?.id ?? null;

  let processed = 0;
  try {
    const { data: appts } = await supabaseAdmin
      .from("appointments")
      .select("id, patient_id, provider_id, scheduled_start")
      .in("status", ["scheduled", "confirmed"])
      .is("checked_in_at", null)
      .eq("no_show_fee_charged", false)
      .lt("scheduled_start", cutoff);

    for (const appt of (appts as ApptRow[] | null) ?? []) {
      // Mark the appointment as a no-show.
      await supabaseAdmin
        .from("appointments")
        .update({ status: "no_show", no_show_fee_charged: true })
        .eq("id", appt.id);
      processed += 1;

      const { data: patientRow } = await supabaseAdmin
        .from("patients")
        .select("id, first_name, last_name, email, stripe_customer_id")
        .eq("id", appt.patient_id)
        .maybeSingle();
      const patient = patientRow as PatientRow | null;
      if (!patient) continue;

      const split = computeSplit(NO_SHOW_FEE_CENTS);
      const providerCents = split.provider;

      let paymentIntentId: string | null = null;
      try {
        const pi = await createNoShowCharge(patient, NO_SHOW_FEE_CENTS, {
          appointment_id: appt.id,
          provider_id: appt.provider_id,
        });
        if (!pi) {
          // No card on file — record the fee as uncollectible.
          await supabaseAdmin.from("no_show_fees").insert({
            appointment_id: appt.id,
            patient_id: appt.patient_id,
            provider_id: appt.provider_id,
            amount: toDollars(NO_SHOW_FEE_CENTS),
            provider_amount: 0,
            platform_amount: 0,
            status: "uncollectible",
            metadata: { reason: "no_card_on_file" },
          });
          continue;
        }
        paymentIntentId = pi.id;
      } catch (err) {
        await supabaseAdmin.from("no_show_fees").insert({
          appointment_id: appt.id,
          patient_id: appt.patient_id,
          provider_id: appt.provider_id,
          amount: toDollars(NO_SHOW_FEE_CENTS),
          status: "failed",
          metadata: { error: err instanceof Error ? err.message : String(err) },
        });
        console.error("[noshow-worker] charge failed for appt", appt.id, err);
        continue;
      }

      // Record the collected fee.
      const { data: feeRow } = await supabaseAdmin
        .from("no_show_fees")
        .insert({
          appointment_id: appt.id,
          patient_id: appt.patient_id,
          provider_id: appt.provider_id,
          amount: toDollars(NO_SHOW_FEE_CENTS),
          provider_amount: toDollars(split.provider),
          platform_amount: toDollars(split.platform),
          stripe_payment_intent_id: paymentIntentId,
          status: "charged",
          charged_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();
      const feeId = (feeRow as { id: string } | null)?.id ?? null;

      // Transfer the provider's share if they're payout-ready.
      const { data: providerRow } = await supabaseAdmin
        .from("providers")
        .select("id, first_name, last_name, phone, stripe_account_id, stripe_payouts_enabled")
        .eq("id", appt.provider_id)
        .maybeSingle();
      const provider = providerRow as ProviderRow | null;

      if (provider?.stripe_account_id && provider.stripe_payouts_enabled) {
        try {
          const transfer = await transferToProvider(providerCents, provider.stripe_account_id, {
            metadata: { type: "no_show_fee", appointment_id: appt.id, fee_id: feeId ?? "" },
          });
          if (feeId) {
            await supabaseAdmin
              .from("no_show_fees")
              .update({ stripe_transfer_id: transfer.id, status: "provider_paid" })
              .eq("id", feeId);
          }
          await sendProviderAlert(
            provider,
            `Heads up: a patient no-showed for an appointment. A $${toDollars(
              NO_SHOW_FEE_CENTS
            ).toFixed(2)} fee was collected and your $${toDollars(providerCents).toFixed(
              2
            )} share is on its way.`
          ).catch(() => undefined);
        } catch (err) {
          console.error("[noshow-worker] provider transfer failed:", err);
        }
      }
    }

    if (logId) {
      await supabaseAdmin
        .from("workers_log")
        .update({
          status: "completed",
          records_processed: processed,
          duration_ms: Date.now() - startedAt,
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }
    console.log(`[noshow-worker] processed ${processed} no-show(s).`);
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
    console.error("[noshow-worker] run failed:", err);
  }

  return processed;
}

/** Schedule no-show detection every 15 minutes. */
export function startNoShowCron(): void {
  console.log("[noshow-worker] scheduled every 15 minutes");
  cron.schedule("*/15 * * * *", () => void runNoShowWorkerOnce());
  void runNoShowWorkerOnce();
}

// Run directly: `tsx workers/noshow-worker.ts`
if (require.main === module) {
  startNoShowCron();
}
