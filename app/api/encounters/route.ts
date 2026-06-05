import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, parseBody, dbError } from "@/lib/api";

export const runtime = "nodejs";

const encounterCreateSchema = z.object({
  appointment_id: z.string().uuid().nullish(),
  patient_id: z.string().uuid(),
  provider_id: z.string().uuid(),
  encounter_date: z.string().optional(),
  chief_complaint: z.string().nullish(),
  subjective: z.string().nullish(),
  objective: z.string().nullish(),
  assessment: z.string().nullish(),
  plan: z.string().nullish(),
  diagnosis_codes: z.array(z.string()).optional(),
  cpt_codes: z.array(z.string()).optional(),
  status: z.enum(["draft", "signed", "amended", "locked"]).optional(),
  signed_by: z.string().uuid().nullish(),
  signed_at: z.string().nullish(),
});

/**
 * GET /api/encounters — list (optional filters:
 * ?patient_id=, ?provider_id=, ?status=).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  let query = supabaseAdmin
    .from("encounters")
    .select("*")
    .order("encounter_date", { ascending: false });

  const patientId = searchParams.get("patient_id");
  const providerId = searchParams.get("provider_id");
  const status = searchParams.get("status");

  if (patientId) query = query.eq("patient_id", patientId);
  if (providerId) query = query.eq("provider_id", providerId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return dbError(error);
  return ok({ encounters: data });
}

/** POST /api/encounters — create an encounter. */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, encounterCreateSchema);
  if (error) return error;

  const { data: created, error: dbErr } = await supabaseAdmin
    .from("encounters")
    .insert(data)
    .select()
    .single();

  if (dbErr) return dbError(dbErr);
  return ok({ encounter: created }, 201);
}
