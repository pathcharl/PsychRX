import { type NextRequest } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail } from "@/lib/api";
import { parseFaxContent } from "@/lib/fax";

export const runtime = "nodejs";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function telnyxPublicKey(): crypto.KeyObject | null {
  const b64 = process.env.TELNYX_PUBLIC_KEY ?? "";
  if (!b64) return null;
  try {
    const raw = Buffer.from(b64, "base64");
    if (raw.length !== 32) return null;
    const der = Buffer.concat([ED25519_SPKI_PREFIX, raw]);
    return crypto.createPublicKey({ key: der, format: "der", type: "spki" });
  } catch {
    return null;
  }
}

function verifyTelnyxSignature(req: NextRequest, rawBody: string): boolean {
  const key = telnyxPublicKey();
  if (!key) return true;

  const signature = req.headers.get("telnyx-signature-ed25519");
  const timestamp = req.headers.get("telnyx-timestamp");
  if (!signature || !timestamp) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return false;
  }

  try {
    const signedPayload = Buffer.from(`${timestamp}|${rawBody}`, "utf8");
    return crypto.verify(
      null,
      signedPayload,
      key,
      Buffer.from(signature, "base64")
    );
  } catch {
    return false;
  }
}

const telnyxEventSchema = z.object({
  data: z
    .object({
      event_type: z.string(),
      id: z.string().optional(),
      occurred_at: z.string().optional(),
      payload: z.record(z.string(), z.unknown()).optional(),
    })
    .passthrough(),
});

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function splitName(full: string | undefined): {
  first: string | null;
  last: string | null;
} {
  if (!full) return { first: null, last: null };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/**
 * POST /api/webhooks/telnyx — inbound fax events.
 * Saves to referrals, parses patient info via Claude, updates the referral row.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifyTelnyxSignature(req, rawBody)) {
    return fail("Invalid Telnyx signature", 403);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const parsed = telnyxEventSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid webhook payload", 422, parsed.error.flatten());
  }

  const { event_type, payload = {}, occurred_at, id: eventId } = parsed.data.data;

  if (event_type !== "fax.received") {
    return ok({ received: true, ignored: event_type });
  }

  const faxId = str(payload.fax_id) ?? eventId ?? null;
  const fromNumber = str(payload.from) ?? null;
  const mediaUrl =
    str(payload.media_url) ?? str(payload.original_media_url) ?? null;
  const receivedAt = occurred_at ?? new Date().toISOString();

  const { data: referral, error: insertErr } = await supabaseAdmin
    .from("referrals")
    .insert({
      referring_fax: fromNumber,
      referring_phone: fromNumber,
      telnyx_fax_id: faxId,
      fax_received_at: receivedAt,
      status: "received",
      parsed_by_ai: false,
      notes: mediaUrl ? `Media: ${mediaUrl}` : null,
    })
    .select("id")
    .single();

  if (insertErr) return fail(insertErr.message, 500);

  let parsedFields: Record<string, unknown> = {};

  if (mediaUrl) {
    try {
      const parsedFax = await parseFaxContent(mediaUrl);
      parsedFields = parsedFax.fields ?? {};
      const patientName = str(parsedFields.patient_name);
      const { first, last } = splitName(patientName ?? undefined);

      await supabaseAdmin
        .from("referrals")
        .update({
          patient_first_name: first,
          patient_last_name: last,
          patient_dob: str(parsedFields.patient_dob),
          patient_phone: str(parsedFields.patient_phone),
          patient_insurance: str(parsedFields.insurance),
          diagnosis_codes: Array.isArray(parsedFields.diagnosis_codes)
            ? (parsedFields.diagnosis_codes as string[])
            : parsedFields.reason_for_referral
              ? [String(parsedFields.reason_for_referral)]
              : null,
          urgency: str(parsedFields.urgency) ?? "routine",
          referring_provider_name: str(parsedFields.referring_provider),
          referring_practice_name: str(parsedFields.referring_practice),
          parsed_by_ai: true,
          status: "processing",
          notes: parsedFax.text?.slice(0, 4000) ?? null,
        })
        .eq("id", referral.id);
    } catch (err) {
      console.error("[telnyx webhook] fax AI parse failed:", err);
    }
  }

  return ok({ received: true, referral_id: referral.id, fax_id: faxId });
}
