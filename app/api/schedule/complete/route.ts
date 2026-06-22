import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody, dbError } from "@/lib/api";
import { createPatientRecord } from "@/lib/intake";
import { confirmBooking } from "@/lib/matching";
import { patchAppointment, setAppointmentTime } from "@/lib/appointments";
import { sendSms } from "@/lib/sms";
import { SESSION_TYPES } from "@/lib/constants";
import { activatePatientPortalAfterBooking } from "@/lib/patient-portal/activation";

export const runtime = "nodejs";

const SERVICE_TO_SESSION: Record<string, string> = {
  therapy: "therapy",
  medication: "medication_management",
  testing: "intake",
};

const completeSchema = z.object({
  provider_id: z.string().uuid(),
  slot_id: z.string().uuid(),
  service_type: z.string().min(1),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  dob: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(7),
  state: z.string().optional(),
  emergency_contact: z.string().optional(),
  insurance: z.string().optional(),
  member_id: z.string().optional(),
});

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
 * POST /api/schedule/complete — create/update patient, book slot, link provider.
 */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, completeSchema);
  if (error) return error;

  const sessionType = SERVICE_TO_SESSION[data.service_type] ?? "follow_up";

  // 1. Validate slot is still open.
  const { data: slot, error: slotErr } = await supabaseAdmin
    .from("provider_slots")
    .select("id, provider_id, start_time, status")
    .eq("id", data.slot_id)
    .maybeSingle();

  if (slotErr) return dbError(slotErr);
  if (!slot) return fail("Slot not found", 404);
  if (slot.status !== "open") {
    return fail("That time slot is no longer available", 409);
  }
  if (slot.provider_id !== data.provider_id) {
    return fail("Slot does not belong to this provider", 400);
  }

  // 2. Create or update patient record.
  let patient;
  try {
    patient = await createPatientRecord({
      channel: "portal",
      first_name: data.first_name,
      last_name: data.last_name,
      dob: data.dob,
      phone: data.phone,
      email: data.email,
      insurance: data.insurance === "Self-pay" ? null : data.insurance,
      care_type: sessionType,
      raw: {
        member_id: data.member_id,
        state: data.state,
        emergency_contact: data.emergency_contact,
      },
    });
  } catch (err) {
    console.error("[schedule/complete] patient create failed:", err);
    return fail(
      err instanceof Error ? err.message : "Could not save patient profile",
      500
    );
  }

  // 3. Link patient to provider + activate.
  await supabaseAdmin
    .from("patients")
    .update({
      primary_provider_id: data.provider_id,
      status: "active",
      state: data.state ?? undefined,
    })
    .eq("id", patient.id);

  // 4. Book the appointment.
  const booked = await confirmBooking(
    data.slot_id,
    patient.id,
    data.provider_id
  );
  if (!booked) {
    return fail("Slot was just taken — please pick another time", 409);
  }

  const sessionMeta = SESSION_TYPES.find((s) => s.value === sessionType);
  await patchAppointment(booked.appointmentId, {
    appointment_type: sessionType,
    duration_minutes: sessionMeta?.defaultDurationMinutes,
  });
  await setAppointmentTime(booked.appointmentId, slot.start_time);

  // 5. Notify patient + provider (best-effort).
  const { data: provider } = await supabaseAdmin
    .from("providers")
    .select("id, first_name, last_name, credentials, phone")
    .eq("id", data.provider_id)
    .maybeSingle();

  const when = formatWhen(slot.start_time);
  const providerName = provider
    ? `${provider.first_name ?? ""} ${provider.last_name ?? ""}`.trim()
    : "your provider";

  await Promise.all([
    sendSms(
      patient.phone,
      `Hi ${patient.first_name}, your PsychRx appointment with ${providerName} is confirmed for ${when}.`,
      { recipientType: "patient", recipientId: patient.id, subject: "Appointment confirmed" }
    ),
    sendSms(
      provider?.phone,
      `New appointment booked: ${patient.first_name} ${patient.last_name} on ${when}.`,
      { recipientType: "provider", recipientId: data.provider_id, subject: "New appointment" }
    ),
  ]);

  const activation = await activatePatientPortalAfterBooking({
    patientId: patient.id,
    email: data.email,
    firstName: patient.first_name,
    lastName: patient.last_name,
    providerName,
    when,
  });

  return ok(
    {
      appointment: {
        id: booked.appointmentId,
        patient_id: patient.id,
        provider_id: data.provider_id,
        provider_name: providerName,
        provider_credentials: provider?.credentials ?? null,
        scheduled_at: slot.start_time,
        session_type: sessionType,
      },
      patient: { id: patient.id, email: patient.email },
      portal: {
        account_created: activation.accountCreated,
        activation_email_sent: activation.emailSent,
      },
    },
    201
  );
}
