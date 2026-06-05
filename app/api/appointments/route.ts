import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, parseBody, dbError } from "@/lib/api";

export const runtime = "nodejs";

const appointmentCreateSchema = z.object({
  patient_id: z.string().uuid(),
  provider_id: z.string().uuid(),
  appointment_type: z
    .enum([
      "initial_eval",
      "follow_up",
      "therapy",
      "medication_management",
      "telehealth",
      "intake",
    ])
    .optional(),
  status: z
    .enum([
      "scheduled",
      "confirmed",
      "completed",
      "cancelled",
      "no_show",
      "rescheduled",
    ])
    .optional(),
  scheduled_start: z.string().min(1),
  scheduled_end: z.string().nullish(),
  location: z.string().nullish(),
  telehealth_link: z.string().nullish(),
  notes: z.string().nullish(),
});

/**
 * GET /api/appointments — list (optional filters:
 * ?patient_id=, ?provider_id=, ?status=, ?from= (ISO), ?to= (ISO)).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  let query = supabaseAdmin
    .from("appointments")
    .select("*")
    .order("scheduled_start", { ascending: true });

  const patientId = searchParams.get("patient_id");
  const providerId = searchParams.get("provider_id");
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (patientId) query = query.eq("patient_id", patientId);
  if (providerId) query = query.eq("provider_id", providerId);
  if (status) query = query.eq("status", status);
  if (from) query = query.gte("scheduled_start", from);
  if (to) query = query.lte("scheduled_start", to);

  const { data, error } = await query;
  if (error) return dbError(error);
  return ok({ appointments: data });
}

/** POST /api/appointments — create an appointment. */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, appointmentCreateSchema);
  if (error) return error;

  const { data: created, error: dbErr } = await supabaseAdmin
    .from("appointments")
    .insert(data)
    .select()
    .single();

  if (dbErr) return dbError(dbErr);
  return ok({ appointment: created }, 201);
}
