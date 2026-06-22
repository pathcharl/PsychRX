import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody, dbError } from "@/lib/api";
import {
  appointmentTime,
  patchAppointment,
  releaseSlotForAppointment,
  lateChangeFee,
} from "@/lib/appointments";
import { createNoShowCharge } from "@/lib/stripe";
import { matchPatientToProvider } from "@/lib/matching";
import { sendSms } from "@/lib/sms";

export const runtime = "nodejs";

const cancelSchema = z.object({
  appointment_id: z.string().uuid(),
  cancelled_by: z.enum(["patient", "provider", "admin"]).default("patient"),
  reason: z.string().max(500).optional(),
});

/** POST /api/appointments/cancel — cancel an appointment. */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, cancelSchema);
  if (error) return error;

  // 1. Load the appointment.
  const { data: appt, error: apptErr } = await supabaseAdmin
    .from("appointments")
    .select("*")
    .eq("id", data.appointment_id)
    .maybeSingle();
  if (apptErr) return dbError(apptErr);
  if (!appt) return fail("Appointment not found", 404);
  if (appt.status === "cancelled") {
    return fail("Appointment is already cancelled", 409);
  }
  if (appt.status === "completed") {
    return fail("Cannot cancel a completed appointment", 409);
  }

  const [{ data: patient }, { data: provider }] = await Promise.all([
    supabaseAdmin
      .from("patients")
      .select("*")
      .eq("id", appt.patient_id)
      .maybeSingle(),
    supabaseAdmin
      .from("providers")
      .select("id, first_name, last_name, phone")
      .eq("id", appt.provider_id)
      .maybeSingle(),
  ]);

  // 2. Determine cancellation timing + fee. Patients are charged a late fee;
  //    provider/admin cancellations are never charged to the patient.
  const scheduledAt = appointmentTime(appt as Record<string, unknown>);
  const feeInfo = lateChangeFee(scheduledAt);
  const shouldCharge = data.cancelled_by === "patient" && feeInfo !== null;

  let chargedFee: { amount: number; payment_intent_id: string | null } | null =
    null;

  if (shouldCharge && feeInfo && patient) {
    try {
      const intent = await createNoShowCharge(
        {
          id: patient.id,
          email: patient.email,
          first_name: patient.first_name,
          last_name: patient.last_name,
        },
        feeInfo.fee * 100,
        { appointment_id: data.appointment_id, type: "late_cancellation" }
      );

      chargedFee = {
        amount: feeInfo.fee,
        payment_intent_id: intent?.id ?? null,
      };

      // Record the fee (best-effort; table shape varies by environment).
      await supabaseAdmin.from("no_show_fees").insert({
        appointment_id: data.appointment_id,
        patient_id: appt.patient_id,
        provider_id: appt.provider_id,
        amount: feeInfo.fee,
        stripe_payment_intent_id: intent?.id ?? null,
        status: intent ? "charged" : "failed",
        charged_at: intent ? new Date().toISOString() : null,
        metadata: { reason: "late_cancellation", cancelled_by: data.cancelled_by },
      });
    } catch (err) {
      console.error("[appointments/cancel] fee charge failed:", err);
    }
  }

  // 3. Update the appointment + free the slot.
  await patchAppointment(data.appointment_id, {
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    cancellation_reason: data.reason,
  });
  await releaseSlotForAppointment(data.appointment_id);

  // 4. Confirm to the patient.
  const feeNote = chargedFee
    ? ` A ${feeInfo?.label ?? "late cancellation fee"} was applied.`
    : "";
  const patientSms = await sendSms(
    patient?.phone,
    `Hi ${patient?.first_name ?? "there"}, your PsychRx appointment has been cancelled.${feeNote} Reply to reschedule.`,
    {
      recipientType: "patient",
      recipientId: appt.patient_id,
      subject: "Appointment cancelled",
    }
  );

  // 5. If the provider cancelled, look for coverage and notify.
  let coverage: { provider_id: string; name: string } | null = null;
  if (data.cancelled_by === "provider" && patient) {
    try {
      const match = await matchPatientToProvider({
        id: patient.id,
        insurance_provider: patient.insurance_provider ?? null,
        care_type: (patient as Record<string, unknown>).care_type as
          | string
          | null
          | undefined,
      });
      if (match && match.provider.id !== appt.provider_id) {
        const name =
          `${match.provider.first_name ?? ""} ${match.provider.last_name ?? ""}`.trim() ||
          "a covering provider";
        coverage = { provider_id: match.provider.id, name };

        const { data: coverProvider } = await supabaseAdmin
          .from("providers")
          .select("id, phone")
          .eq("id", match.provider.id)
          .maybeSingle();
        await sendSms(
          coverProvider?.phone,
          `Coverage needed: a patient appointment was cancelled by their provider and you are the best match. Please review in your portal.`,
          {
            recipientType: "provider",
            recipientId: match.provider.id,
            subject: "Coverage opportunity",
          }
        );
      }
    } catch (err) {
      console.error("[appointments/cancel] coverage lookup failed:", err);
    }
  } else {
    // Patient/admin cancellation — let the provider know the slot freed up.
    await sendSms(
      provider?.phone,
      `An upcoming appointment was cancelled${
        data.reason ? ` (${data.reason})` : ""
      }.`,
      {
        recipientType: "provider",
        recipientId: appt.provider_id,
        subject: "Appointment cancelled",
      }
    );
  }

  return ok({
    appointment: {
      id: data.appointment_id,
      status: "cancelled",
      cancelled_by: data.cancelled_by,
    },
    fee: chargedFee,
    coverage,
    notifications: { patient_sms: !patientSms.skipped },
  });
}
