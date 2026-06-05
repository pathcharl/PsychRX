import { type NextRequest } from "next/server";
import { verifyTwilioWebhookSignature } from "@/lib/twilio";
import { supabaseAdmin } from "@/lib/supabase";
import { toE164 } from "@/lib/utils";
import { findProviderByPhone } from "@/workers/sms-router";

export const runtime = "nodejs";

const PROVIDER_COMMANDS = ["SICK", "AVAILABLE", "UNAVAILABLE", "HELP"] as const;
type ProviderCommand = (typeof PROVIDER_COMMANDS)[number];

function twiml(message?: string) {
  const escaped = message
    ? message.replace(/[<>&'"]/g, (c) =>
        ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!)
      )
    : null;
  const body = escaped
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response/>`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function twilioWebhookUrl(req: NextRequest): string {
  const override = process.env.TWILIO_WEBHOOK_URL;
  if (override) return override;

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}`;
}

function getTwilioParam(params: Record<string, string>, name: string): string {
  if (params[name] != null) return params[name];
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(params)) {
    if (key.toLowerCase() === target) return value;
  }
  return "";
}

async function parseTwilioParams(req: NextRequest): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const raw = await req.text();
    console.log("[twilio webhook] raw body:", raw);

    const params: Record<string, string> = {};
    new URLSearchParams(raw).forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = String(value);
  });

  const rawBody = getTwilioParam(params, "Body");
  console.log("[twilio webhook] raw Body:", rawBody);

  return params;
}

function parseCommand(body: string): ProviderCommand | null {
  const normalized = body
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n?|\n/g, " ")
    .trim()
    .toUpperCase();

  const token = (normalized.split(/\s+/).filter(Boolean)[0] ?? "").replace(
    /[^A-Z0-9]/g,
    ""
  );

  return PROVIDER_COMMANDS.includes(token as ProviderCommand)
    ? (token as ProviderCommand)
    : null;
}

function helpMessage(): string {
  return (
    "PsychRx provider commands:\n" +
    "SICK — report out sick (coverage workflow starts)\n" +
    "AVAILABLE — mark yourself available\n" +
    "UNAVAILABLE — mark yourself unavailable\n" +
    "HELP — show this list"
  );
}

async function saveSmsCommand(input: {
  providerId: string | null;
  fromPhone: string;
  command: string;
  rawMessage: string;
  response: string;
}) {
  await supabaseAdmin.from("sms_commands").insert({
    provider_id: input.providerId,
    from_phone: input.fromPhone,
    command: input.command,
    raw_message: input.rawMessage,
    processed: true,
    response_sent: input.response,
  });
}

async function handleProviderCommand(
  command: ProviderCommand,
  providerId: string | null
): Promise<string> {
  switch (command) {
    case "SICK":
      if (providerId) {
        await supabaseAdmin
          .from("providers")
          .update({
            available: false,
            unavailable_reason: "sick",
            unavailable_since: new Date().toISOString(),
          })
          .eq("id", providerId);
      }
      return "Got it. We are finding coverage and notifying your patients now.";

    case "AVAILABLE":
      if (providerId) {
        await supabaseAdmin
          .from("providers")
          .update({
            available: true,
            unavailable_reason: null,
            unavailable_since: null,
          })
          .eq("id", providerId);
      }
      return "You are marked available. Thank you!";

    case "UNAVAILABLE":
      if (providerId) {
        await supabaseAdmin
          .from("providers")
          .update({
            available: false,
            unavailable_reason: "unavailable",
            unavailable_since: new Date().toISOString(),
          })
          .eq("id", providerId);
      }
      return "You are marked unavailable. We'll hold new bookings until you're back.";

    case "HELP":
      return helpMessage();

    default:
      return "Command not recognized. Text HELP for available commands.";
  }
}

/** POST /api/webhooks/twilio — inbound SMS (provider commands + logging). */
export async function POST(req: NextRequest) {
  const params = await parseTwilioParams(req);

  if (
    !verifyTwilioWebhookSignature(
      req.headers.get("x-twilio-signature"),
      twilioWebhookUrl(req),
      params
    )
  ) {
    return new Response("Invalid Twilio signature", { status: 403 });
  }

  const from = getTwilioParam(params, "From");
  const rawBody = getTwilioParam(params, "Body")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n?|\n/g, " ")
    .trim();

  console.log("[twilio webhook] raw Body:", JSON.stringify(rawBody));

  if (!from) return twiml();

  const fromE164 = toE164(from) || from;
  const command = parseCommand(rawBody);
  const provider = await findProviderByPhone(from);

  console.log(
    "[twilio webhook] parsed command:",
    command ?? "none",
    "provider:",
    provider?.id ?? "not found"
  );

  let reply: string;

  if (command) {
    reply = await handleProviderCommand(command, provider?.id ?? null);
  } else {
    reply = "Command not recognized. Text HELP for available commands.";
  }

  await saveSmsCommand({
    providerId: provider?.id ?? null,
    fromPhone: fromE164,
    command: command ?? "UNKNOWN",
    rawMessage: rawBody,
    response: reply,
  });

  return twiml(reply);
}
