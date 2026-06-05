// ============================================================================
// Stripe Connect helpers for PsychRx.
//   * Providers onboard as Express connected accounts (transfers capability)
//   * Patients are charged on the platform; 75% is transferred to the provider
//     and 25% is retained by PsychRx (separate charges & transfers model)
//
// NOTE: Per Stripe best practice we never pass `payment_method_types` — dynamic
// payment methods are enabled via `automatic_payment_methods`.
// For a brand-new platform Stripe now recommends Accounts v2 + controller
// properties; Express (v1) is used here per the PsychRx spec.
// ============================================================================
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { APP_URL } from "@/lib/constants";

const secretKey = process.env.STRIPE_SECRET_KEY ?? "";

/** Provider share of every transaction (default 75%). */
export const PROVIDER_SPLIT_PCT = Number(process.env.PROVIDER_SPLIT_PCT ?? 0.75);
/** Fixed no-show fee in cents (default $150.00). */
export const NO_SHOW_FEE_CENTS = Number(process.env.NO_SHOW_FEE_CENTS ?? 15000);

let instance: Stripe | null = null;

function getClient(): Stripe {
  if (!instance) {
    if (!secretKey) {
      throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
    }
    instance = new Stripe(secretKey);
  }
  return instance;
}

/**
 * Singleton Stripe client. Created on first access so a missing/placeholder
 * key never throws at import time.
 */
export const stripe = new Proxy({} as Stripe, {
  get(_t, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as Stripe;

/** Split an amount (in cents) into provider (75%) and platform (25%) shares. */
export function computeSplit(amountCents: number): {
  provider: number;
  platform: number;
} {
  const provider = Math.round(amountCents * PROVIDER_SPLIT_PCT);
  return { provider, platform: amountCents - provider };
}

// ---------------------------------------------------------------------------
// Connect onboarding
// ---------------------------------------------------------------------------

export interface ConnectProvider {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

/** Create an Express connected account for a provider (transfers capability). */
export async function createConnectAccount(
  provider: ConnectProvider
): Promise<Stripe.Account> {
  const account = await getClient().accounts.create({
    type: "express",
    email: provider.email ?? undefined,
    business_type: "individual",
    capabilities: {
      transfers: { requested: true },
      card_payments: { requested: true },
    },
    metadata: { provider_id: provider.id },
  });

  await supabaseAdmin
    .from("providers")
    .update({ stripe_account_id: account.id })
    .eq("id", provider.id);

  return account;
}

/** Create an account onboarding link for a connected account. */
export async function getOnboardingLink(accountId: string): Promise<string> {
  const link = await getClient().accountLinks.create({
    account: accountId,
    refresh_url:
      process.env.STRIPE_CONNECT_REFRESH_URL ?? `${APP_URL}/provider/onboarding?refresh=1`,
    return_url:
      process.env.STRIPE_CONNECT_RETURN_URL ?? `${APP_URL}/provider/onboarding?complete=1`,
    type: "account_onboarding",
  });
  return link.url;
}

// ---------------------------------------------------------------------------
// Customers + charges
// ---------------------------------------------------------------------------

export interface ChargePatient {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  stripe_customer_id?: string | null;
}

/** Ensure a patient has a Stripe customer, creating + persisting one if needed. */
export async function ensureCustomer(patient: ChargePatient): Promise<string> {
  if (patient.stripe_customer_id) return patient.stripe_customer_id;

  const customer = await getClient().customers.create({
    email: patient.email ?? undefined,
    name: [patient.first_name, patient.last_name].filter(Boolean).join(" ") || undefined,
    metadata: { patient_id: patient.id },
  });

  await supabaseAdmin
    .from("patients")
    .update({ stripe_customer_id: customer.id })
    .eq("id", patient.id);

  return customer.id;
}

/**
 * Create a PaymentIntent to charge a patient (amount in cents).
 * Uses automatic payment methods (no `payment_method_types`).
 */
export async function createPaymentIntent(
  amount: number,
  customerId: string,
  options: { metadata?: Record<string, string>; description?: string } = {}
): Promise<Stripe.PaymentIntent> {
  return getClient().paymentIntents.create({
    amount,
    currency: "usd",
    customer: customerId,
    description: options.description,
    metadata: options.metadata,
    automatic_payment_methods: { enabled: true },
  });
}

/** The customer's default card payment method, if one is on file. */
async function defaultPaymentMethod(customerId: string): Promise<string | null> {
  const customer = await getClient().customers.retrieve(customerId);
  if (!customer || customer.deleted) return null;
  const fromSettings = customer.invoice_settings?.default_payment_method;
  if (typeof fromSettings === "string") return fromSettings;
  if (fromSettings && "id" in fromSettings) return fromSettings.id;

  const methods = await getClient().paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 1,
  });
  return methods.data[0]?.id ?? null;
}

/**
 * Charge a no-show fee to the patient's card on file (off-session).
 * Returns null when the patient has no usable card.
 */
export async function createNoShowCharge(
  patient: ChargePatient,
  amount: number = NO_SHOW_FEE_CENTS,
  metadata: Record<string, string> = {}
): Promise<Stripe.PaymentIntent | null> {
  const customerId = await ensureCustomer(patient);
  const paymentMethod = await defaultPaymentMethod(customerId);
  if (!paymentMethod) return null;

  return getClient().paymentIntents.create({
    amount,
    currency: "usd",
    customer: customerId,
    payment_method: paymentMethod,
    off_session: true,
    confirm: true,
    description: "No-show fee",
    metadata: { type: "no_show_fee", ...metadata },
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
  });
}

// ---------------------------------------------------------------------------
// Transfers + balance
// ---------------------------------------------------------------------------

/** Transfer the provider's share (in cents) to their connected account. */
export async function transferToProvider(
  amount: number,
  accountId: string,
  options: { metadata?: Record<string, string>; transferGroup?: string } = {}
): Promise<Stripe.Transfer> {
  return getClient().transfers.create({
    amount,
    currency: "usd",
    destination: accountId,
    transfer_group: options.transferGroup,
    metadata: options.metadata,
  });
}

/** Retrieve a connected account's Stripe balance. */
export async function getProviderBalance(
  accountId: string
): Promise<Stripe.Balance> {
  return getClient().balance.retrieve({}, { stripeAccount: accountId });
}

// ---------------------------------------------------------------------------
// Webhook processing
// ---------------------------------------------------------------------------

/** Construct + verify a webhook event from the raw request body. */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!secret) throw new Error("Missing STRIPE_WEBHOOK_SECRET.");
  return getClient().webhooks.constructEvent(payload, signature, secret);
}

/** Process a verified Stripe webhook event, updating the database. */
export async function handleWebhook(
  event: Stripe.Event
): Promise<{ handled: boolean; type: string }> {
  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await supabaseAdmin
        .from("payments")
        .update({ status: "succeeded" })
        .eq("stripe_payment_intent_id", pi.id);
      await supabaseAdmin
        .from("no_show_fees")
        .update({ status: "charged", charged_at: new Date().toISOString() })
        .eq("stripe_payment_intent_id", pi.id);
      return { handled: true, type: event.type };
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await supabaseAdmin
        .from("payments")
        .update({ status: "failed" })
        .eq("stripe_payment_intent_id", pi.id);
      return { handled: true, type: event.type };
    }

    case "transfer.created": {
      const transfer = event.data.object as Stripe.Transfer;
      await supabaseAdmin
        .from("provider_payments")
        .update({ status: "paid" })
        .eq("stripe_transfer_id", transfer.id);
      await supabaseAdmin
        .from("no_show_fees")
        .update({ status: "provider_paid" })
        .eq("stripe_transfer_id", transfer.id);
      return { handled: true, type: event.type };
    }

    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      const onboarded = Boolean(account.details_submitted);
      await supabaseAdmin
        .from("providers")
        .update({
          stripe_onboarded: onboarded,
          stripe_charges_enabled: Boolean(account.charges_enabled),
          stripe_payouts_enabled: Boolean(account.payouts_enabled),
        })
        .eq("stripe_account_id", account.id);
      return { handled: true, type: event.type };
    }

    default:
      return { handled: false, type: event.type };
  }
}

export default stripe;
