import { type NextRequest } from "next/server";
import { verifyTwilioWebhookSignature } from "@/lib/twilio";
import { startCarolCall } from "@/lib/carol";
import { gatherSpeechResponse, emptyResponse } from "@/lib/twiml";

export const runtime = "nodejs";

const CAROL_ACTION = "/api/voice/carol";

function twilioWebhookUrl(req: NextRequest): string {
  const override = process.env.TWILIO_VOICE_INBOUND_URL;
  if (override) return override;

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}`;
}

/** POST /api/voice/inbound — Twilio Voice webhook for inbound calls to Carol. */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return emptyResponse();
  }

  const params: Record<string, string> = {};
  form.forEach((value, key) => (params[key] = String(value)));

  if (
    !verifyTwilioWebhookSignature(
      req.headers.get("x-twilio-signature"),
      twilioWebhookUrl(req),
      params
    )
  ) {
    return new Response("Invalid Twilio signature", { status: 403 });
  }

  const callSid = String(form.get("CallSid") ?? "");
  const from = form.get("From") ? String(form.get("From")) : null;
  const to = form.get("To") ? String(form.get("To")) : null;

  if (!callSid) return emptyResponse();

  const { say, audioUrl } = await startCarolCall({ callSid, from, to });

  return gatherSpeechResponse({
    prompt: { audioUrl, sayText: say },
    actionPath: CAROL_ACTION,
  });
}
