import crypto from "crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody, dbError } from "@/lib/api";
import { sendSms } from "@/lib/sms";
import { sendEmail } from "@/lib/resend";
import { APP_NAME } from "@/lib/constants";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Stateless one-time-code (OTP) tokens.
//
// We don't persist codes in a table — instead we send the 6-digit code to the
// user and return a signed token (HMAC of the code + payload) to the browser.
// On verify, the browser sends the token back along with the typed code and we
// recompute the HMAC. The code itself is never exposed in the token.
// ---------------------------------------------------------------------------
const OTP_SECRET =
  process.env.OTP_SECRET ??
  process.env.SUPABASE_SERVICE_KEY ??
  "psychrx-otp-dev-secret";
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface OtpPayload {
  provider_id: string;
  field: "email" | "phone";
  value: string;
  exp: number;
}

function signOtp(payloadB64: string, code: string): string {
  return crypto
    .createHmac("sha256", OTP_SECRET)
    .update(`${payloadB64}.${code}`)
    .digest("base64url");
}

function createOtpToken(payload: OtpPayload, code: string): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${signOtp(payloadB64, code)}`;
}

function verifyOtpToken(token: string, code: string): OtpPayload | null {
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  const expected = signOtp(payloadB64, code);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString()
    ) as OtpPayload;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

const updateSchema = z.object({
  provider_id: z.string().uuid(),
  telehealth_link: z.string().optional(),
  direct_phone: z.string().optional(),
  direct_fax: z.string().optional(),
  pt_profile_url: z.string().optional(),
  caqh_last_attested: z.string().optional(),
});

const actionSchema = z.object({
  provider_id: z.string().uuid(),
  action: z.enum(["send_verification", "verify"]),
  field: z.enum(["email", "phone"]),
  value: z.string().optional(),
  code: z.string().optional(),
  token: z.string().optional(),
});

/** PATCH — update provider profile fields. */
export async function PATCH(req: NextRequest) {
  const { data, error } = await parseBody(req, updateSchema);
  if (error) return error;

  const { provider_id, ...fields } = data;
  const updates = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined)
  );

  if (!Object.keys(updates).length) return fail("No fields to update", 400);

  const { error: dbErr } = await supabaseAdmin
    .from("providers")
    .update(updates)
    .eq("id", provider_id);

  if (dbErr) return dbError(dbErr);
  return ok({ updated: true });
}

/** POST — SMS verification flow for email/phone updates. */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, actionSchema);
  if (error) return error;

  if (data.action === "send_verification") {
    const value = data.value?.trim();
    if (!value) return fail("Enter a value to verify first.", 400);

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const token = createOtpToken(
      {
        provider_id: data.provider_id,
        field: data.field,
        value,
        exp: Date.now() + OTP_TTL_MS,
      },
      code
    );

    if (data.field === "phone") {
      const result = await sendSms(
        value,
        `Your ${APP_NAME} verification code is ${code}. It expires in 10 minutes.`,
        {
          recipientType: "provider",
          recipientId: data.provider_id,
          subject: "Verification code",
        }
      );
      if (result.skipped) {
        const message =
          result.reason === "invalid_phone"
            ? "That phone number looks invalid. Enter it in international format, e.g. +234 801 234 5678."
            : "We couldn't send an SMS to that number — it may not be reachable from our SMS provider. Try verifying by email instead.";
        return fail(message, 502);
      }
    } else {
      try {
        await sendEmail({
          to: value,
          subject: `Your ${APP_NAME} verification code`,
          html:
            `<p>Your ${APP_NAME} verification code is:</p>` +
            `<p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>` +
            `<p style="color:#666;font-size:14px">This code expires in 10 minutes.</p>`,
          text: `Your ${APP_NAME} verification code is ${code}. It expires in 10 minutes.`,
        });
      } catch (err) {
        console.error("[portal/settings] email OTP send failed:", err);
        return fail(
          "We couldn't send the verification email. Please try again shortly.",
          502
        );
      }
    }

    return ok({ sent: true, token });
  }

  if (data.action === "verify") {
    const value = data.value?.trim();
    const code = data.code?.trim();
    if (!value || !code || !data.token) {
      return fail("Enter the code we sent you.", 400);
    }

    const payload = verifyOtpToken(data.token, code);
    if (
      !payload ||
      payload.provider_id !== data.provider_id ||
      payload.field !== data.field ||
      payload.value !== value
    ) {
      return fail(
        "That code is incorrect or has expired. Request a new one.",
        400
      );
    }

    const field = data.field === "email" ? "email" : "phone";
    const { error: dbErr } = await supabaseAdmin
      .from("providers")
      .update({ [field]: value })
      .eq("id", data.provider_id);

    if (dbErr) return dbError(dbErr);
    return ok({ verified: true });
  }

  return fail("Invalid verification", 400);
}
