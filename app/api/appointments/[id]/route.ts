import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody, dbError } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: { id: string } };

const appointmentUpdateSchema = z
  .object({
    patient_id: z.string().uuid(),
    provider_id: z.string().uuid(),
    appointment_type: z.enum([
      "initial_eval",
      "follow_up",
      "therapy",
      "medication_management",
      "telehealth",
      "intake",
    ]),
    status: z.enum([
      "scheduled",
      "confirmed",
      "completed",
      "cancelled",
      "no_show",
      "rescheduled",
    ]),
    scheduled_start: z.string().min(1),
    scheduled_end: z.string().nullish(),
    location: z.string().nullish(),
    telehealth_link: z.string().nullish(),
    notes: z.string().nullish(),
  })
  .partial();

const idSchema = z.string().uuid();

/** GET /api/appointments/:id */
export async function GET(_req: NextRequest, { params }: Params) {
  if (!idSchema.safeParse(params.id).success) return fail("Invalid id", 400);

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return dbError(error);
  if (!data) return fail("Appointment not found", 404);
  return ok({ appointment: data });
}

/** PUT /api/appointments/:id */
export async function PUT(req: NextRequest, { params }: Params) {
  if (!idSchema.safeParse(params.id).success) return fail("Invalid id", 400);

  const { data, error } = await parseBody(req, appointmentUpdateSchema);
  if (error) return error;
  if (Object.keys(data).length === 0) return fail("No fields to update", 400);

  const { data: updated, error: dbErr } = await supabaseAdmin
    .from("appointments")
    .update(data)
    .eq("id", params.id)
    .select()
    .maybeSingle();

  if (dbErr) return dbError(dbErr);
  if (!updated) return fail("Appointment not found", 404);
  return ok({ appointment: updated });
}

/** DELETE /api/appointments/:id */
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!idSchema.safeParse(params.id).success) return fail("Invalid id", 400);

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .delete()
    .eq("id", params.id)
    .select()
    .maybeSingle();

  if (error) return dbError(error);
  if (!data) return fail("Appointment not found", 404);
  return ok({ success: true, appointment: data });
}
