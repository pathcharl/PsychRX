import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody, dbError } from "@/lib/api";
import {
  appointmentTime,
  setAppointmentTime,
  patchAppointment,
  releaseSlotForAppointment,
  lateChangeFee,
} from "@/lib/appointments";
import { sendSms } from "@/lib/sms";

export const runtime = "nodejs";

/** Patients may self-reschedule at most twice per calendar month. */
const MAX_RESCHEDULES_PER_MONTH = 2;

const rescheduleSchema = z
  .object({
    appointment_id: z.string().uuid(),
    new_slot_id: z.string().uuid().optional(),
    new_scheduled_at: z.string().datetime().optional(),
    reason: z.string().max(500).optional(),
  })
  .refine((d) => d.new_slot_id || d.new_scheduled_at, {
    message: "Provide either new_slot_id or new_scheduled_at",
    path: ["new_slot_id"],
  });

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "the new time";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: process.env.OFFICE_TIMEZONE ?? "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** POST /api/appointments/reschedule — move an appointment to a new time. */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, rescheduleSchema);
  if (error) return error;

  // 1. Load the appointment.
  const { data: appt, error: apptErr } = await supabaseAdmin
    .from("appointments")
    .select("*")
    .eq("id", data.appointment_id)
    .maybeSingle();
  if (apptErr) return dbError(apptErr);
  if (!appt) return fail("Appointment not found", 404);
  if (appt.status === "cancelled" || appt.status === "completed") {
    return fail(`Cannot reschedule a ${appt.status} appointment`, 409);
  }

  // 2. Enforce the monthly reschedule cap (from the patients row).
  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("*")
    .eq("id", appt.patient_id)
    .maybeSingle();

  const rescheduleCount = Number(patient?.reschedule_count_this_month ?? 0) || 0;
  if (rescheduleCount >= MAX_RESCHEDULES_PER_MONTH) {
    return fail(
      `Reschedule limit reached (${MAX_RESCHEDULES_PER_MONTH} per month). Please contact the office.`,
      409,
      { reschedule_count_this_month: rescheduleCount }
    );
  }

  // 3. Determine the new time + any late-change fee warning.
  const currentTime = appointmentTime(appt as Record<string, unknown>);
  const feeWarning = lateChangeFee(currentTime);

  // 4. Resolve the new slot / time.
  let newTime = data.new_scheduled_at ?? null;
  let newSlot: { id: string; start_time: string } | null = null;

  if (data.new_slot_id) {
    const { data: slot, error: slotErr } = await supabaseAdmin
      .from("provider_slots")
      .select("id, provider_id, start_time, status")
      .eq("id", data.new_slot_id)
      .maybeSingle();
    if (slotErr) return dbError(slotErr);
    if (!slot) return fail("New slot not found", 404);
    if (slot.status !== "open") {
      return fail("Selected slot is no longer available", 409);
    }
    newSlot = { id: slot.id, start_time: slot.start_time };
    newTime = slot.start_time;
  }

  if (!newTime) return fail("Could not determine a new time", 400);

  // 5. Move the booking. Free the old slot first, then claim the new one.
  if (newSlot) {
    await releaseSlotForAppointment(data.appointment_id);

    const { data: claimed } = await supabaseAdmin
      .from("provider_slots")
      .update({
        status: "booked",
        appointment_id: data.appointment_id,
        held_for_patient_id: appt.patient_id,
        hold_expires_at: null,
      })
      .eq("id", newSlot.id)
      .eq("status", "open")
      .select("id")
      .maybeSingle();

    if (!claimed) {
      return fail("Selected slot was just taken — please pick another", 409);
    }
  }

  await setAppointmentTime(data.appointment_id, newTime);
  await patchAppointment(data.appointment_id, {
    status: "scheduled",
    reschedule_reason: data.reason,
    rescheduled_from: currentTime ?? undefined,
  });

  // 6. Increment the patient's monthly reschedule counter (best-effort).
  await supabaseAdmin
    .from("patients")
    .update({ reschedule_count_this_month: rescheduleCount + 1 })
    .eq("id", appt.patient_id);

  // 7. Notify patient + provider of the new time.
  const { data: provider } = await supabaseAdmin
    .from("providers")
    .select("id, first_name, last_name, phone")
    .eq("id", appt.provider_id)
    .maybeSingle();

  const when = formatWhen(newTime);
  const feeNote = feeWarning ? ` Note: ${feeWarning.label} applies.` : "";

  const [patientSms, providerSms] = await Promise.all([
    sendSms(
      patient?.phone,
      `Hi ${patient?.first_name ?? "there"}, your PsychRx appointment has been rescheduled to ${when}.${feeNote}`,
      {
        recipientType: "patient",
        recipientId: appt.patient_id,
        subject: "Appointment rescheduled",
      }
    ),
    sendSms(
      provider?.phone,
      `An appointment has been rescheduled to ${when}.`,
      {
        recipientType: "provider",
        recipientId: appt.provider_id,
        subject: "Appointment rescheduled",
      }
    ),
  ]);

  return ok({
    appointment: {
      id: data.appointment_id,
      patient_id: appt.patient_id,
      provider_id: appt.provider_id,
      scheduled_at: newTime,
      status: "scheduled",
    },
    fee_warning: feeWarning,
    reschedule_count_this_month: rescheduleCount + 1,
    notifications: {
      patient_sms: !patientSms.skipped,
      provider_sms: !providerSms.skipped,
    },
  });
}
