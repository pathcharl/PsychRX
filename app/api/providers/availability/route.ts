import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody, dbError } from "@/lib/api";
import { generateSlotsForProvider } from "@/lib/slots";

export const runtime = "nodejs";

const createTemplateSchema = z.object({
  provider_id: z.string().uuid(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  slot_duration_minutes: z.number().int().min(15).max(240).optional(),
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
  is_active: z.boolean().optional(),
});

const deleteTemplateSchema = z.object({
  template_id: z.string().uuid(),
  provider_id: z.string().uuid().optional(),
});

/** GET /api/providers/availability?provider_id= — list availability templates. */
export async function GET(req: NextRequest) {
  const providerId = req.nextUrl.searchParams.get("provider_id");
  if (!providerId) return fail("provider_id is required", 400);

  const { data, error } = await supabaseAdmin
    .from("availability_templates")
    .select("*")
    .eq("provider_id", providerId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) return dbError(error);
  return ok({ templates: data ?? [] });
}

/**
 * POST /api/providers/availability — create a template and regenerate slots
 * for the next 30 days.
 */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, createTemplateSchema);
  if (error) return error;

  const { data: created, error: dbErr } = await supabaseAdmin
    .from("availability_templates")
    .insert({
      provider_id: data.provider_id,
      day_of_week: data.day_of_week,
      start_time: data.start_time.length === 5 ? `${data.start_time}:00` : data.start_time,
      end_time: data.end_time.length === 5 ? `${data.end_time}:00` : data.end_time,
      slot_duration_minutes: data.slot_duration_minutes ?? 60,
      appointment_type: data.appointment_type ?? "follow_up",
      is_active: data.is_active ?? true,
    })
    .select()
    .single();

  if (dbErr) return dbError(dbErr);

  let slotsGenerated = 0;
  try {
    slotsGenerated = await generateSlotsForProvider(data.provider_id);
  } catch (err) {
    console.error("[availability] slot generation failed:", err);
  }

  return ok({ template: created, slots_generated: slotsGenerated }, 201);
}

/** DELETE /api/providers/availability — remove a template (body: template_id). */
export async function DELETE(req: NextRequest) {
  const { data, error } = await parseBody(req, deleteTemplateSchema);
  if (error) return error;

  let query = supabaseAdmin
    .from("availability_templates")
    .delete()
    .eq("id", data.template_id);

  if (data.provider_id) query = query.eq("provider_id", data.provider_id);

  const { error: dbErr } = await query;
  if (dbErr) return dbError(dbErr);

  return ok({ deleted: true, template_id: data.template_id });
}
