import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody, dbError } from "@/lib/api";
import { getAdminApiUser } from "@/lib/admin/auth";
import { appointmentTime, patchAppointment } from "@/lib/appointments";
import { sendSms } from "@/lib/sms";

export const runtime = "nodejs";

const assignSchema = z.object({
  appointment_id: z.string().uuid(),
  coverage_provider_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

function formatWhen(iso: string | null): string {
  if (!iso) return "the scheduled time";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "the scheduled time";
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
 * POST /api/admin/coverage/assign — manually reassign an appointment to a
 * covering provider (admin only).
 */
export async function POST(req: NextRequest) {
  const admin = await getAdminApiUser();
  if (!admin) return fail("Admin access required", 401);

  const { data, error } = await parseBody(req, assignSchema);
  if (error) return error;

  // 1. Validate the appointment + coverage provider.
  const { data: appt, error: apptErr } = await supabaseAdmin
    .from("appointments")
    .select("*")
    .eq("id", data.appointment_id)
    .maybeSingle();
  if (apptErr) return dbError(apptErr);
  if (!appt) return fail("Appointment not found", 404);

  if (appt.provider_id === data.coverage_provider_id) {
    return fail("Coverage provider is already assigned", 400);
  }

  const { data: coverage } = await supabaseAdmin
    .from("providers")
    .select("id, first_name, last_name, credentials, phone, status")
    .eq("id", data.coverage_provider_id)
    .maybeSingle();
  if (!coverage) return fail("Coverage provider not found", 404);

  const originalProviderId = appt.provider_id;

  // 2. Reassign. provider_id always exists; coverage metadata is best-effort.
  const { error: reassignErr } = await supabaseAdmin
    .from("appointments")
    .update({ provider_id: data.coverage_provider_id })
    .eq("id", data.appointment_id);
  if (reassignErr) return dbError(reassignErr);

  await patchAppointment(data.appointment_id, {
    is_coverage: true,
    original_provider_id: originalProviderId,
    coverage_reason: data.reason,
  });

  // Move any booked slot ownership to the coverage provider (best-effort).
  await supabaseAdmin
    .from("provider_slots")
    .update({ provider_id: data.coverage_provider_id })
    .eq("appointment_id", data.appointment_id);

  // 3. Notify the patient + the coverage provider.
  const when = formatWhen(appointmentTime(appt as Record<string, unknown>));
  const coverageName =
    `${coverage.first_name ?? ""} ${coverage.last_name ?? ""}`.trim() ||
    "a covering provider";

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("id, first_name, phone")
    .eq("id", appt.patient_id)
    .maybeSingle();

  const [patientSms, providerSms] = await Promise.all([
    sendSms(
      patient?.phone,
      `Hi ${patient?.first_name ?? "there"}, your PsychRx appointment on ${when} will now be with ${coverageName}. Everything else stays the same.`,
      {
        recipientType: "patient",
        recipientId: appt.patient_id,
        subject: "Provider change",
      }
    ),
    sendSms(
      coverage.phone,
      `You've been assigned a coverage appointment with ${patient?.first_name ?? "a patient"} on ${when}. Details are in your portal.`,
      {
        recipientType: "provider",
        recipientId: data.coverage_provider_id,
        subject: "Coverage assignment",
      }
    ),
  ]);

  // 4. Log to worker_logs.
  await supabaseAdmin.from("worker_logs").insert({
    worker_name: "coverage-assign",
    status: "completed",
    message: `Admin ${admin.email ?? admin.id} reassigned appointment ${
      data.appointment_id
    } from provider ${originalProviderId} to ${data.coverage_provider_id}${
      data.reason ? ` (${data.reason})` : ""
    }`,
    records_processed: 1,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });

  return ok({
    appointment_id: data.appointment_id,
    original_provider_id: originalProviderId,
    coverage_provider_id: data.coverage_provider_id,
    notifications: {
      patient_sms: !patientSms.skipped,
      provider_sms: !providerSms.skipped,
    },
  });
}
