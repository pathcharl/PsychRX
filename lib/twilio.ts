import twilio, { type Twilio } from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";

/** PsychRx outbound caller ID / SMS sender. */
export const TWILIO_PHONE_PSYCHRX = process.env.TWILIO_PHONE_PSYCHRX ?? "";

let instance: Twilio | null = null;

/** Lazily create the singleton Twilio REST client. */
function getClient(): Twilio {
  if (!instance) {
    if (!accountSid || !authToken) {
      throw new Error(
        "Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN."
      );
    }
    instance = twilio(accountSid, authToken);
  }
  return instance;
}

/**
 * Singleton Twilio client. The real client is created on first access so a
 * missing/placeholder SID never throws at import time.
 */
const twilioClient = new Proxy({} as Twilio, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as Twilio;

/** Validate an inbound Twilio webhook request signature. */
export function verifyTwilioWebhookSignature(
  signature: string | null,
  url: string,
  params: Record<string, string>
): boolean {
  if (process.env.NODE_ENV === "development") {
    // skip signature validation in dev
    return true;
  }

  if (!authToken) return true;
  if (!signature) return false;

  return twilio.validateRequest(authToken, signature, url, params);
}

/** Send an SMS message from the PsychRx number. */
export async function sendSms(to: string, body: string) {
  return getClient().messages.create({
    to,
    from: TWILIO_PHONE_PSYCHRX,
    body,
  });
}

/** Place an outbound voice call (TwiML URL or inline <Response>). */
export async function makeCall(to: string, twimlUrl: string) {
  return getClient().calls.create({
    to,
    from: TWILIO_PHONE_PSYCHRX,
    url: twimlUrl,
  });
}

export default twilioClient;
