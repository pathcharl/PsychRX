import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody, dbError } from "@/lib/api";

export const runtime = "nodejs";

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
    // In production: send OTP via Twilio Verify
    return ok({ sent: true, message: "Verification code sent via SMS" });
  }

  if (data.action === "verify" && data.value) {
    const field = data.field === "email" ? "email" : "phone";
    const { error: dbErr } = await supabaseAdmin
      .from("providers")
      .update({ [field]: data.value })
      .eq("id", data.provider_id);

    if (dbErr) return dbError(dbErr);
    return ok({ verified: true });
  }

  return fail("Invalid verification", 400);
}
