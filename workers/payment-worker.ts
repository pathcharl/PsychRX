/**
 * PsychRx Payment Worker (weekly payouts)
 * ---------------------------------------
 * Runs every Sunday at 11pm (office tz) and:
 *   1. finds completed, unpaid sessions from the past week
 *   2. groups them by provider and computes the 75/25 split
 *   3. transfers each provider's 75% via Stripe Connect
 *   4. records the payout in provider_payments + marks sessions paid
 *   5. texts the provider a payment confirmation (with a celebration level)
 *
 * Money note: appointment.fee_amount is stored in dollars; Stripe transfers use
 * cents. Amounts are converted accordingly.
 */
import cron from "node-cron";
import { supabaseAdmin } from "@/lib/supabase";
import { transferToProvider, computeSplit } from "@/lib/stripe";
import { sendProviderAlert } from "@/lib/sms";

const OFFICE_TIMEZONE = process.env.OFFICE_TIMEZONE ?? "America/New_York";
const DEFAULT_SESSION_FEE = Number(process.env.SESSION_DEFAULT_FEE ?? 0);

const toCents = (dollars: number) => Math.round(dollars * 100);
const toDollars = (cents: number) => Math.round(cents) / 100;

/** A celebratory tier based on the week's take-home. */
function celebrationLevel(providerDollars: number): string {
  if (providerDollars >= 5000) return "legendary";
  if (providerDollars >= 2500) return "amazing";
  if (providerDollars >= 1000) return "great";
  if (providerDollars > 0) return "nice";
  return "none";
}

const CELEBRATION_EMOJI: Record<string, string> = {
  legendary: "🏆🎉",
  amazing: "🌟",
  great: "🎉",
  nice: "👏",
  none: "",
};

interface ApptRow {
  id: string;
  provider_id: string;
  fee_amount: number | null;
}

interface ProviderRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  stripe_account_id: string | null;
  stripe_payouts_enabled: boolean | null;
}

/** Run one weekly payout pass. Returns the number of providers paid. */
export async function runPaymentWorkerOnce(): Promise<number> {
  const startedAt = Date.now();
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 7 * 86_400_000);

  const { data: logRow } = await supabaseAdmin
    .from("workers_log")
    .insert({ worker_name: "payment-worker", job_type: "weekly_payout", status: "running" })
    .select("id")
    .maybeSingle();
  const logId = (logRow as { id: string } | null)?.id ?? null;

  let providersPaid = 0;
  try {
    const { data: appts } = await supabaseAdmin
      .from("appointments")
      .select("id, provider_id, fee_amount")
      .eq("status", "completed")
      .eq("paid_to_provider", false)
      .gte("scheduled_start", periodStart.toISOString())
      .lte("scheduled_start", periodEnd.toISOString());

    // Group sessions by provider.
    const byProvider = new Map<string, ApptRow[]>();
    for (const appt of (appts as ApptRow[] | null) ?? []) {
      const list = byProvider.get(appt.provider_id) ?? [];
      list.push(appt);
      byProvider.set(appt.provider_id, list);
    }

    for (const [providerId, sessions] of Array.from(byProvider.entries())) {
      const { data: providerRow } = await supabaseAdmin
        .from("providers")
        .select("id, first_name, last_name, phone, stripe_account_id, stripe_payouts_enabled")
        .eq("id", providerId)
        .maybeSingle();
      const provider = providerRow as ProviderRow | null;
      if (!provider?.stripe_account_id || !provider.stripe_payouts_enabled) {
        console.warn(`[payment-worker] provider ${providerId} not payout-ready; skipping`);
        continue;
      }

      const grossCents = sessions.reduce(
        (sum: number, s: ApptRow) => sum + toCents(s.fee_amount ?? DEFAULT_SESSION_FEE),
        0
      );
      if (grossCents <= 0) continue;

      const { provider: providerCents, platform: platformCents } = computeSplit(grossCents);

      // Create the payout record first (pending), then transfer.
      const { data: payment } = await supabaseAdmin
        .from("provider_payments")
        .insert({
          provider_id: providerId,
          period_start: periodStart.toISOString().slice(0, 10),
          period_end: periodEnd.toISOString().slice(0, 10),
          session_count: sessions.length,
          gross_amount: toDollars(grossCents),
          provider_amount: toDollars(providerCents),
          platform_amount: toDollars(platformCents),
          status: "pending",
          celebration_level: celebrationLevel(toDollars(providerCents)),
        })
        .select("id")
        .maybeSingle();
      const paymentId = (payment as { id: string } | null)?.id ?? null;

      try {
        const transfer = await transferToProvider(providerCents, provider.stripe_account_id, {
          metadata: { provider_id: providerId, payment_id: paymentId ?? "" },
          transferGroup: `weekly-${periodEnd.toISOString().slice(0, 10)}`,
        });

        if (paymentId) {
          await supabaseAdmin
            .from("provider_payments")
            .update({ stripe_transfer_id: transfer.id, status: "paid" })
            .eq("id", paymentId);
        }

        // Mark the sessions paid.
        await supabaseAdmin
          .from("appointments")
          .update({ paid_to_provider: true, provider_payment_id: paymentId })
          .in(
            "id",
            sessions.map((s: ApptRow) => s.id)
          );

        // Celebrate with the provider.
        const dollars = toDollars(providerCents);
        const level = celebrationLevel(dollars);
        const emoji = CELEBRATION_EMOJI[level] ?? "";
        const firstName = provider.first_name ?? "there";
        await sendProviderAlert(
          provider,
          `${emoji} Hi ${firstName}, your weekly PsychRx payout of $${dollars.toFixed(2)} ` +
            `for ${sessions.length} session(s) is on its way to your bank. Thank you for the great work!`
        ).catch((err) => console.error("[payment-worker] confirmation SMS failed:", err));

        providersPaid += 1;
      } catch (err) {
        if (paymentId) {
          await supabaseAdmin
            .from("provider_payments")
            .update({ status: "failed", metadata: { error: String(err) } })
            .eq("id", paymentId);
        }
        console.error(`[payment-worker] transfer failed for provider ${providerId}:`, err);
      }
    }

    if (logId) {
      await supabaseAdmin
        .from("workers_log")
        .update({
          status: "completed",
          records_processed: providersPaid,
          duration_ms: Date.now() - startedAt,
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }
    console.log(`[payment-worker] paid ${providersPaid} provider(s).`);
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
    console.error("[payment-worker] run failed:", err);
  }

  return providersPaid;
}

/** Schedule weekly payouts for Sunday 11:00pm office time. */
export function startPaymentCron(): void {
  console.log(`[payment-worker] scheduled Sundays 11:00pm (${OFFICE_TIMEZONE})`);
  cron.schedule("0 23 * * 0", () => void runPaymentWorkerOnce(), {
    timezone: OFFICE_TIMEZONE,
  });
}

// Run directly: schedule, or `RUN_ONCE=1 tsx workers/payment-worker.ts` for one pass.
if (require.main === module) {
  if (process.env.RUN_ONCE) {
    void runPaymentWorkerOnce().then(() => process.exit(0));
  } else {
    startPaymentCron();
  }
}
