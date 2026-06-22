import { type NextRequest } from "next/server";
import { format } from "date-fns";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, parseBody, dbError } from "@/lib/api";

export const runtime = "nodejs";

const submitSchema = z.object({
  appointment_id: z.string().uuid(),
  provider_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  ai_note_generated: z.string().min(50),
  cpt_code: z.string(),
  session_modality: z.string(),
  phone_session_reason: z.string().nullish(),
  session_type: z.string(),
  audit_results: z.array(z.object({
    status: z.enum(["pass", "fail", "warn"]),
    label: z.string(),
    detail: z.string().optional(),
  })).optional(),
});

/** POST /api/portal/scribe/submit — create encounter and queue claim. */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, submitSchema);
  if (error) return error;

  const today = format(new Date(), "yyyy-MM-dd");
  const hasFails = data.audit_results?.some((a) => a.status === "fail");

  const { data: encounter, error: encErr } = await supabaseAdmin
    .from("encounters")
    .insert({
      appointment_id: data.appointment_id,
      provider_id: data.provider_id,
      patient_id: data.patient_id,
      date_of_service: today,
      cpt_code: data.cpt_code,
      icd10_primary: "F41.9",
      session_modality: data.session_modality,
      phone_session_reason: data.phone_session_reason,
      ai_note_generated: data.ai_note_generated,
      note_approved: true,
      provider_attested: true,
      attested_at: new Date().toISOString(),
      ai_audit_approved: !hasFails,
      ai_audit_issues: data.audit_results ?? [],
      claim_status: "pending",
      charge_amount: 200,
      expected_reimbursement: 180,
    })
    .select()
    .single();

  if (encErr) return dbError(encErr);

  await supabaseAdmin
    .from("appointments")
    .update({ encounter_submitted: true })
    .eq("id", data.appointment_id);

  return ok({ encounter, claim_queued: true }, 201);
}
