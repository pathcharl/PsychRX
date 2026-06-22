import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody, dbError } from "@/lib/api";
import { confirmBooking } from "@/lib/matching";
import { patchAppointment, setAppointmentTime } from "@/lib/appointments";
import { sendSms } from "@/lib/sms";
import { SESSION_TYPES } from "@/lib/constants";

export const runtime = "nodejs";

const APPOINTMENT_TYPES = [
  "initial_eval",
  "follow_up",
  "therapy",
  "medication_management",
  "telehealth",
  "intake",
] as const;

const bookSchema = z.object({
  patient_id: z.string().uuid(),
  provider_id: z.string().uuid(),
  slot_id: z.string().uuid(),
  session_type: z.string().min(1),
});

/** Format a scheduled time for SMS in US Eastern by default. */
function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "your scheduled time";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: process.env.OFFICE_TIMEZONE ?? "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/**
 * POST /api/appointments/book — book a new appointment.
 * Validates the slot is still open, atomically books it, then notifies the
 * patient and provider by SMS.
 */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, bookSchema);
  if (error) return error;

  // 1. Slot must still be open.
  const { data: slot, error: slotErr } = await supabaseAdmin
    .from("provider_slots")
    .select("id, provider_id, start_time, end_time, status")
    .eq("id", data.slot_id)
    .maybeSingle();

  if (slotErr) return dbError(slotErr);
  if (!slot) return fail("Slot not found", 404);
  if (slot.status !== "open") {
    return fail("Slot is no longer available", 409);
  }
  if (slot.provider_id !== data.provider_id) {
    return fail("Slot does not belong to this provider", 400);
  }

  // 2. Confirm the booking (creates the appointment + marks the slot booked,
  //    guarding against a race where someone else grabs the slot first).
  const booked = await confirmBooking(
    data.slot_id,
    data.patient_id,
    data.provider_id
  );
  if (!booked) {
    return fail("Slot was just taken — please pick another time", 409);
  }

  // 3. Persist the session/appointment type + scheduled time across the
  //    DB's time columns (best-effort; tolerates differing schemas).
  const sessionType = data.session_type.trim();
  const isKnownType = (APPOINTMENT_TYPES as readonly string[]).includes(
    sessionType
  );
  const sessionMeta = SESSION_TYPES.find((s) => s.value === sessionType);
  await patchAppointment(booked.appointmentId, {
    appointment_type: isKnownType ? sessionType : undefined,
    duration_minutes: sessionMeta?.defaultDurationMinutes,
  });
  await setAppointmentTime(booked.appointmentId, slot.start_time);

  // 4. Load contact details for notifications.
  const [{ data: patient }, { data: provider }] = await Promise.all([
    supabaseAdmin
      .from("patients")
      .select("id, first_name, last_name, phone")
      .eq("id", data.patient_id)
      .maybeSingle(),
    supabaseAdmin
      .from("providers")
      .select("id, first_name, last_name, credentials, phone")
      .eq("id", data.provider_id)
      .maybeSingle(),
  ]);

  const when = formatWhen(slot.start_time);
  const providerName = provider
    ? `${provider.first_name ?? ""} ${provider.last_name ?? ""}`.trim() ||
      "your provider"
    : "your provider";

  // 5. Confirmation SMS to the patient + heads-up to the provider.
  const [patientSms, providerSms] = await Promise.all([
    sendSms(
      patient?.phone,
      `Hi ${patient?.first_name ?? "there"}, your PsychRx appointment with ${providerName} is confirmed for ${when}. Reply CANCEL to cancel.`,
      {
        recipientType: "patient",
        recipientId: data.patient_id,
        subject: "Appointment confirmed",
      }
    ),
    sendSms(
      provider?.phone,
      `New PsychRx appointment booked: ${patient?.first_name ?? "patient"} ${
        patient?.last_name ?? ""
      }`.trim() + ` on ${when}.`,
      {
        recipientType: "provider",
        recipientId: data.provider_id,
        subject: "New appointment",
      }
    ),
  ]);

  return ok(
    {
      appointment: {
        id: booked.appointmentId,
        patient_id: data.patient_id,
        provider_id: data.provider_id,
        slot_id: data.slot_id,
        session_type: sessionType,
        scheduled_at: slot.start_time,
        status: "scheduled",
      },
      notifications: {
        patient_sms: !patientSms.skipped,
        provider_sms: !providerSms.skipped,
      },
    },
    201
  );
}
