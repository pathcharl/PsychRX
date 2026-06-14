import { type NextRequest } from "next/server";
import { constructWebhookEvent, handleWebhook } from "@/lib/stripe";
import { ok, fail } from "@/lib/api";

export const runtime = "nodejs";

/**
 * POST /api/stripe/webhook — verifies the Stripe signature against the raw
 * body, then processes the event (payment_intent.succeeded, transfer.created,
 * account.updated, ...).
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return fail("Missing stripe-signature header", 400);

  // The raw body bytes are required for signature verification.
  const rawBody = await req.text();

  let event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    return fail(
      `Webhook signature verification failed: ${
        err instanceof Error ? err.message : "unknown error"
      }`,
      400
    );
  }

  try {
    const result = await handleWebhook(event);
    return ok({ received: true, ...result });
  } catch (err) {
    // Returning 500 lets Stripe retry delivery.
    return fail(err instanceof Error ? err.message : "Webhook handling failed", 500);
  }
}
