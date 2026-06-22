import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { generateSlotsForProvider } from "@/lib/slots";
import { ok, parseBody, dbError } from "@/lib/api";

export const runtime = "nodejs";

const daySchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  enabled: z.boolean(),
  start_time: z.string(),
  end_time: z.string(),
  slot_duration_minutes: z.number().int().min(15).max(240),
  buffer_minutes: z.number().int().min(0).max(60).optional(),
  max_sessions: z.number().int().min(1).max(20).optional(),
  template_id: z.string().uuid().nullish(),
});

const saveSchema = z.object({
  provider_id: z.string().uuid(),
  days: z.array(daySchema),
  accepts_new_patients: z.boolean(),
});

const blockSchema = z.object({
  provider_id: z.string().uuid(),
  blocked_date: z.string(),
  reason: z.string().optional(),
});

const vacationSchema = z.object({
  provider_id: z.string().uuid(),
  vacation_command: z.string().min(5),
});

/** POST — save weekly schedule and regenerate slots for 60 days. */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, saveSchema);
  if (error) return error;

  await supabaseAdmin
    .from("providers")
    .update({ accepts_new_patients: data.accepts_new_patients })
    .eq("id", data.provider_id);

  for (const day of data.days) {
    if (day.enabled) {
      const payload = {
        provider_id: data.provider_id,
        day_of_week: day.day_of_week,
        start_time: day.start_time.length === 5 ? `${day.start_time}:00` : day.start_time,
        end_time: day.end_time.length === 5 ? `${day.end_time}:00` : day.end_time,
        slot_duration_minutes: day.slot_duration_minutes,
        is_active: true,
      };

      if (day.template_id) {
        await supabaseAdmin
          .from("availability_templates")
          .update(payload)
          .eq("id", day.template_id);
      } else {
        await supabaseAdmin.from("availability_templates").insert(payload);
      }
    } else if (day.template_id) {
      await supabaseAdmin
        .from("availability_templates")
        .update({ is_active: false })
        .eq("id", day.template_id);
    }
  }

  let slotsGenerated = 0;
  try {
    slotsGenerated = await generateSlotsForProvider(data.provider_id, 60);
  } catch (err) {
    console.error("[portal/availability] slot generation:", err);
  }

  return ok({ saved: true, slots_generated: slotsGenerated });
}

/** PUT — block a specific date. */
export async function PUT(req: NextRequest) {
  const { data, error } = await parseBody(req, blockSchema);
  if (error) return error;

  const { error: dbErr } = await supabaseAdmin.from("blocked_dates").upsert(
    {
      provider_id: data.provider_id,
      blocked_date: data.blocked_date,
      reason: data.reason ?? null,
    },
    { onConflict: "provider_id,blocked_date" }
  );

  if (dbErr) return dbError(dbErr);
  return ok({ blocked: true });
}

/** PATCH — submit vacation request. */
export async function PATCH(req: NextRequest) {
  const { data, error } = await parseBody(req, vacationSchema);
  if (error) return error;

  const match = data.vacation_command.match(
    /VACATION\s+(\w+\s+\d+)\s+to\s+(\w+\s+\d+)/i
  );

  const { error: dbErr } = await supabaseAdmin.from("provider_absences").insert({
    provider_id: data.provider_id,
    absence_type: "vacation",
    start_date: match ? null : new Date().toISOString().split("T")[0],
    end_date: match ? null : new Date().toISOString().split("T")[0],
    notes: data.vacation_command,
    status: "active",
  });

  if (dbErr) return dbError(dbErr);
  return ok({ submitted: true });
}
