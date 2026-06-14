/**
 * PsychRx Payment Worker (weekly payouts)
 * ---------------------------------------
 * Runs every Sunday at 6pm EST and:
 *   1. finds all completed encounters not yet paid out
 *      (provider_payout_status = 'pending')
 *   2. groups them by provider and calculates the 75% provider share
 *   3. creates a Stripe transfer to the provider's stripe_account_id
 *   4. updates each encounter's provider_payout_status to 'paid'
 *   5. records the payout in provider_payments and texts the provider
 *
 * Money note: encounter amounts are stored in dollars; Stripe transfers use
 * cents. Each run is recorded in worker_logs.
 */
import cron from "node-cron";
import { supabaseAdmin } from "@/lib/supabase";
import { transferToProvider, computeSplit } from "@/lib/stripe";
import { sendProviderAlert } from "@/lib/sms";
import { withWorkerLog } from "@/workers/worker-log";

const WORKER_NAME = "payment-worker";
const PAYOUT_TIMEZONE = process.env.PAYOUT_TIMEZONE ?? "America/New_York"; // EST/EDT

const toCents = (dollars: number) => Math.round(dollars * 100);
const toDollars = (cents: number) => Math.round(cents) / 100;

interface EncounterRow {
  id: string;
  provider_id: string;
  charge_amount: number | null;
  paid_amount: number | null;
}

interface ProviderRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  stripe_account_id: string | null;
}

/** Payout basis for one encounter: insurance-paid amount, else billed charge. */
function encounterCents(e: EncounterRow): number {
  const dollars = Number(e.paid_amount ?? e.charge_amount ?? 0);
  return dollars > 0 ? toCents(dollars) : 0;
}

/** Run one weekly payout pass. Returns the number of providers paid. */
export async function runPaymentWorkerOnce(): Promise<number> {
  let providersPaid = 0;

  await withWorkerLog(WORKER_NAME, async () => {
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 7 * 86_400_000);

    // Encounters that haven't been paid out to the provider yet.
    // (No status column on encounters; provider_payout_status is the gate.)
    const { data: encounters } = await supabaseAdmin
      .from("encounters")
      .select("id, provider_id, charge_amount, paid_amount")
      .eq("provider_payout_status", "pending");

    const byProvider = new Map<string, EncounterRow[]>();
    for (const enc of (encounters as EncounterRow[] | null) ?? []) {
      if (encounterCents(enc) <= 0) continue;
      const list = byProvider.get(enc.provider_id) ?? [];
      list.push(enc);
      byProvider.set(enc.provider_id, list);
    }

    let encountersPaid = 0;

    for (const [providerId, rows] of Array.from(byProvider.entries())) {
      const { data: providerRow } = await supabaseAdmin
        .from("providers")
        .select("id, first_name, last_name, phone, stripe_account_id")
        .eq("id", providerId)
        .maybeSingle();
      const provider = providerRow as ProviderRow | null;
      if (!provider?.stripe_account_id) {
        console.warn(`[${WORKER_NAME}] provider ${providerId} has no Stripe account; skipping`);
        continue;
      }

      const grossCents = rows.reduce((sum, e) => sum + encounterCents(e), 0);
      if (grossCents <= 0) continue;

      const { provider: providerCents, platform: platformCents } =
        computeSplit(grossCents);

      // Record the payout first (pending), then transfer.
      const { data: payment } = await supabaseAdmin
        .from("provider_payments")
        .insert({
          provider_id: providerId,
          period_start: periodStart.toISOString().slice(0, 10),
          period_end: periodEnd.toISOString().slice(0, 10),
          session_count: rows.length,
          gross_amount: toDollars(grossCents),
          provider_amount: toDollars(providerCents),
          platform_amount: toDollars(platformCents),
          status: "pending",
        })
        .select("id")
        .maybeSingle();
      const paymentId = (payment as { id: string } | null)?.id ?? null;

      try {
        const transfer = await transferToProvider(
          providerCents,
          provider.stripe_account_id,
          {
            metadata: { provider_id: providerId, payment_id: paymentId ?? "" },
            transferGroup: `weekly-${periodEnd.toISOString().slice(0, 10)}`,
          }
        );

        if (paymentId) {
          await supabaseAdmin
            .from("provider_payments")
            .update({ stripe_transfer_id: transfer.id, status: "paid" })
            .eq("id", paymentId);
        }

        // Mark each encounter as paid out (with its own 75% share).
        const paidAt = new Date().toISOString();
        for (const enc of rows) {
          const { provider: share } = computeSplit(encounterCents(enc));
          await supabaseAdmin
            .from("encounters")
            .update({
              provider_payout_status: "paid",
              provider_payout_amount: toDollars(share),
              provider_payout_at: paidAt,
            })
            .eq("id", enc.id);
        }
        encountersPaid += rows.length;

        const dollars = toDollars(providerCents);
        await sendProviderAlert(
          provider,
          `Hi ${provider.first_name ?? "there"}, your weekly PsychRx payout of ` +
            `$${dollars.toFixed(2)} for ${rows.length} session(s) is on its way ` +
            `to your bank. Thank you for the great work!`
        ).catch((err) =>
          console.error(`[${WORKER_NAME}] confirmation SMS failed:`, err)
        );

        providersPaid += 1;
      } catch (err) {
        if (paymentId) {
          await supabaseAdmin
            .from("provider_payments")
            .update({ status: "failed", metadata: { error: String(err) } })
            .eq("id", paymentId);
        }
        console.error(`[${WORKER_NAME}] transfer failed for provider ${providerId}:`, err);
      }
    }

    return {
      records: encountersPaid,
      message: `paid ${providersPaid} provider(s) for ${encountersPaid} encounter(s)`,
    };
  });

  return providersPaid;
}

/** Schedule weekly payouts for Sunday 6:00pm EST. */
export function startPaymentWorker(): void {
  console.log(`[${WORKER_NAME}] scheduled Sundays at 18:00 (${PAYOUT_TIMEZONE})`);
  cron.schedule("0 18 * * 0", () => void runPaymentWorkerOnce(), {
    timezone: PAYOUT_TIMEZONE,
  });
}

// Run directly: schedule, or `RUN_ONCE=1 tsx workers/payment-worker.ts` for one pass.
if (require.main === module) {
  if (process.env.RUN_ONCE) {
    void runPaymentWorkerOnce().then(() => process.exit(0));
  } else {
    startPaymentWorker();
  }
}
