import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, parseBody, dbError } from "@/lib/api";
import { sendReferralFax } from "@/lib/fax";
import { matchPatientToProvider } from "@/lib/matching";
import { sendSms } from "@/lib/sms";

export const runtime = "nodejs";

const referralSchema = z.object({
  referring_provider_name: z.string().min(1),
  referring_provider_npi: z.string().optional(),
  referring_practice_name: z.string().optional(),
  referring_fax: z.string().optional(),
  referring_phone: z.string().optional(),
  patient_first_name: z.string().min(1),
  patient_last_name: z.string().min(1),
  patient_dob: z.string().optional(),
  patient_phone: z.string().optional(),
  patient_insurance: z.string().optional(),
  patient_member_id: z.string().optional(),
  diagnosis_codes: z.array(z.string()).optional(),
  urgency: z.enum(["routine", "urgent", "emergent"]).default("routine"),
  notes: z.string().max(2000).optional(),
});

/** POST /api/referrals/submit — intake a doctor referral from the /refer page. */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, referralSchema);
  if (error) return error;

  // 1. Save the referral.
  const { data: referral, error: dbErr } = await supabaseAdmin
    .from("referrals")
    .insert({
      referring_provider_name: data.referring_provider_name,
      referring_provider_npi: data.referring_provider_npi ?? null,
      referring_practice_name: data.referring_practice_name ?? null,
      referring_fax: data.referring_fax ?? null,
      referring_phone: data.referring_phone ?? null,
      patient_first_name: data.patient_first_name,
      patient_last_name: data.patient_last_name,
      patient_dob: data.patient_dob ?? null,
      patient_phone: data.patient_phone ?? null,
      patient_insurance: data.patient_insurance ?? null,
      patient_member_id: data.patient_member_id ?? null,
      diagnosis_codes: data.diagnosis_codes ?? null,
      urgency: data.urgency,
      notes: data.notes ?? null,
      status: "received",
    })
    .select()
    .single();

  if (dbErr) return dbError(dbErr);

  const patientName = `${data.patient_first_name} ${data.patient_last_name}`;

  // 2. Trigger the patient-matching workflow (best-effort suggestion).
  let suggestedProvider: { id: string; name: string } | null = null;
  try {
    const match = await matchPatientToProvider({
      insurance_provider: data.patient_insurance,
    });
    if (match) {
      suggestedProvider = {
        id: match.provider.id,
        name:
          `${match.provider.first_name ?? ""} ${match.provider.last_name ?? ""}`.trim() ||
          "a provider",
      };
      await supabaseAdmin
        .from("referrals")
        .update({ status: "processing" })
        .eq("id", referral.id);
    }
  } catch (err) {
    console.error("[referrals/submit] matching failed:", err);
  }

  // 3. Send a confirmation fax back to the referring doctor.
  let faxSent = false;
  if (data.referring_fax) {
    try {
      const result = await sendReferralFax(
        { name: data.referring_provider_name, fax: data.referring_fax },
        `We have received your referral for ${patientName}. Our team will reach out to the patient to schedule. ` +
          `Reference #${referral.id}. Thank you for trusting PsychRx with your patient's care.`
      );
      faxSent = !result.skipped;
    } catch (err) {
      console.error("[referrals/submit] confirmation fax failed:", err);
    }
  }

  // 4. SMS the owner (Patrick) a referral summary.
  await sendSms(
    process.env.OWNER_PHONE,
    `New referral (${data.urgency}): ${patientName} from ${data.referring_provider_name}` +
      `${data.patient_insurance ? `, ins: ${data.patient_insurance}` : ""}. Ref #${referral.id}.`,
    { recipientType: "owner", subject: "New referral" }
  );

  return ok(
    {
      referral_id: referral.id,
      referral,
      suggested_provider: suggestedProvider,
      confirmation_fax_sent: faxSent,
    },
    201
  );
}
