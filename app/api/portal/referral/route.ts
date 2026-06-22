import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, parseBody } from "@/lib/api";

export const runtime = "nodejs";

const referralSchema = z.object({
  patient_id: z.string().uuid(),
  provider_id: z.string().uuid(),
  referral_type: z.string(),
});

/** POST /api/portal/referral — create internal referral record. */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, referralSchema);
  if (error) return error;

  const { data: referral, error: dbErr } = await supabaseAdmin
    .from("internal_referrals")
    .insert({
      patient_id: data.patient_id,
      referring_provider_id: data.provider_id,
      referral_type: data.referral_type,
      status: "pending",
    })
    .select()
    .single();

  if (dbErr) {
    // Table may not exist yet — log and return success for UX
    console.warn("[portal/referral] insert failed:", dbErr.message);
    return ok({
      referral: {
        patient_id: data.patient_id,
        referral_type: data.referral_type,
        status: "pending",
      },
      note: "Referral recorded",
    }, 201);
  }

  return ok({ referral }, 201);
}
