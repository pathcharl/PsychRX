import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { getPortalPatient } from "@/lib/patient-portal/auth";
import { resolveMessagingProviderId } from "@/lib/patient-portal/data";
import { confirmBooking } from "@/lib/matching";
import { patchAppointment, setAppointmentTime } from "@/lib/appointments";
import { SESSION_TYPES } from "@/lib/constants";

export const runtime = "nodejs";

const completeSchema = z.object({
  slot_id: z.string().uuid(),
});

/**
 * POST /api/patient-portal/schedule
 * Book a slot for the *already authenticated* patient against their existing
 * provider — no new patient record, no account-activation email.
 */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return fail("Not authenticated", 401);

  const patient = await getPortalPatient(user);
  if (!patient) return fail("No patient profile found for this account", 403);

  const { data, error } = await parseBody(req, completeSchema);
  if (error) return error;

  const { data: slot } = await supabaseAdmin
    .from("provider_slots")
    .select("id, provider_id, start_time, status")
    .eq("id", data.slot_id)
    .maybeSingle();

  if (!slot) return fail("Slot not found", 404);
  if (slot.status !== "open") {
    return fail("That time slot is no longer available", 409);
  }

  const providerId = slot.provider_id as string;

  // Only allow booking with the patient's own care-team provider.
  const allowedProviderId = await resolveMessagingProviderId(patient);
  if (allowedProviderId && allowedProviderId !== providerId) {
    return fail("You can only book with your assigned provider.", 403);
  }

  const booked = await confirmBooking(slot.id as string, patient.id, providerId);
  if (!booked) {
    return fail("Slot was just taken — please pick another time", 409);
  }

  const sessionType = patient.care_type ?? "follow_up";
  const sessionMeta = SESSION_TYPES.find((s) => s.value === sessionType);
  await patchAppointment(booked.appointmentId, {
    appointment_type: sessionType,
    duration_minutes: sessionMeta?.defaultDurationMinutes,
  });
  await setAppointmentTime(booked.appointmentId, slot.start_time as string);

  // Keep the primary provider in sync in case it was never persisted.
  if (!patient.primary_provider_id) {
    await supabaseAdmin
      .from("patients")
      .update({ primary_provider_id: providerId })
      .eq("id", patient.id);
  }

  return ok(
    {
      appointment: {
        id: booked.appointmentId,
        provider_id: providerId,
        scheduled_at: slot.start_time,
      },
    },
    201
  );
}
