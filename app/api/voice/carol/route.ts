import { type NextRequest } from "next/server";
import { verifyTwilioWebhookSignature } from "@/lib/twilio";
import { handleCarolTurn } from "@/lib/carol";
import {
  gatherSpeechResponse,
  hangupResponse,
  dialResponse,
  emptyResponse,
} from "@/lib/twiml";
import { toE164 } from "@/lib/utils";

export const runtime = "nodejs";

const CAROL_ACTION = "/api/voice/carol";
const TRANSFER_NUMBER =
  toE164(process.env.CAROL_TRANSFER_NUMBER) || toE164(process.env.OWNER_PHONE);

function twilioWebhookUrl(req: NextRequest): string {
  const override = process.env.TWILIO_VOICE_CAROL_URL;
  if (override) return override;

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}`;
}

/** POST /api/voice/carol — processes caller speech and continues the call. */
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
  const speech = String(form.get("SpeechResult") ?? "");

  if (!callSid) return emptyResponse();

  let say: string;
  let audioUrl: string | null;
  let action: string;
  try {
    const result = await handleCarolTurn({ callSid, from, to, speech });
    say = result.say;
    audioUrl = result.audioUrl;
    action = result.action;
  } catch (err) {
    console.error("[voice/carol] turn failed:", err);
    return hangupResponse({
      sayText:
        "I'm sorry, I'm having trouble right now. Please call back in a few minutes. Goodbye.",
    });
  }

  const prompt = { audioUrl, sayText: say };

  if (action === "end") {
    return hangupResponse(prompt);
  }

  if (action === "transfer") {
    if (TRANSFER_NUMBER) {
      return dialResponse({ prompt, dialNumber: TRANSFER_NUMBER });
    }
    return hangupResponse(prompt);
  }

  return gatherSpeechResponse({ prompt, actionPath: CAROL_ACTION });
}
