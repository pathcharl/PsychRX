import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody, dbError } from "@/lib/api";
import { getAdminApiUser } from "@/lib/admin/auth";
import { releaseSlotForAppointment } from "@/lib/appointments";
import { sendSms } from "@/lib/sms";

export const runtime = "nodejs";

type Params = { params: { id: string } };

const idSchema = z.string().uuid();

const updateSchema = z.object({
  status: z.enum(["active", "inactive", "suspended", "pending"]),
  reason: z.string().max(500).optional(),
});

/** Statuses that take a provider offline (suspended). */
const SUSPEND_STATUSES = new Set(["inactive", "suspended"]);

/** PUT /api/admin/providers/:id — change a provider's status (admin only). */
export async function PUT(req: NextRequest, { params }: Params) {
  // 1. Admin auth.
  const admin = await getAdminApiUser();
  if (!admin) return fail("Admin access required", 401);

  if (!idSchema.safeParse(params.id).success) return fail("Invalid id", 400);

  const { data, error } = await parseBody(req, updateSchema);
  if (error) return error;

  const { data: existing } = await supabaseAdmin
    .from("providers")
    .select("id, first_name, last_name, phone, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!existing) return fail("Provider not found", 404);

  // 2. Update the status. If the DB's check constraint rejects 'suspended',
  //    fall back to 'inactive' (which the admin UI renders as "suspended").
  const update = {
    status: data.status,
    suspension_reason: SUSPEND_STATUSES.has(data.status)
      ? data.reason ?? null
      : null,
  };

  let { data: updated, error: dbErr } = await supabaseAdmin
    .from("providers")
    .update(update)
    .eq("id", params.id)
    .select()
    .maybeSingle();

  if (dbErr && (dbErr.code === "23514" || dbErr.code === "PGRST204")) {
    // Either the status value or the suspension_reason column is unsupported.
    const fallbackStatus = data.status === "suspended" ? "inactive" : data.status;
    ({ data: updated, error: dbErr } = await supabaseAdmin
      .from("providers")
      .update({ status: fallbackStatus })
      .eq("id", params.id)
      .select()
      .maybeSingle());
  }

  if (dbErr) return dbError(dbErr);
  if (!updated) return fail("Provider not found", 404);

  const isSuspending = SUSPEND_STATUSES.has(data.status);
  let cancelledAppointments = 0;

  // 3. When suspending, cancel upcoming appointments + notify patients.
  if (isSuspending) {
    const { data: upcoming } = await supabaseAdmin
      .from("appointments")
      .select("id, patient_id")
      .eq("provider_id", params.id)
      .in("status", ["scheduled", "confirmed"]);

    for (const appt of (upcoming ?? []) as Array<{
      id: string;
      patient_id: string;
    }>) {
      await supabaseAdmin
        .from("appointments")
        .update({
          status: "cancelled",
          cancellation_reason: "provider_suspended",
        })
        .eq("id", appt.id);
      await releaseSlotForAppointment(appt.id);
      cancelledAppointments += 1;

      const { data: patient } = await supabaseAdmin
        .from("patients")
        .select("id, first_name, phone")
        .eq("id", appt.patient_id)
        .maybeSingle();
      await sendSms(
        patient?.phone,
        `Hi ${patient?.first_name ?? "there"}, we need to reschedule your upcoming PsychRx appointment. Our team will reach out shortly with a new time.`,
        {
          recipientType: "patient",
          recipientId: appt.patient_id,
          subject: "Appointment rescheduling needed",
        }
      );
    }
  }

  // 4. Notify the provider of the status change.
  const statusMsg = isSuspending
    ? `Your PsychRx provider account has been suspended.${
        data.reason ? ` Reason: ${data.reason}.` : ""
      } Please contact the office.`
    : `Your PsychRx provider account status is now: ${data.status}.`;
  const providerSms = await sendSms(existing.phone, statusMsg, {
    recipientType: "provider",
    recipientId: params.id,
    subject: "Account status change",
  });

  // 5. Audit log (best-effort).
  await supabaseAdmin.from("audit_log").insert({
    actor_id: admin.id,
    actor_email: admin.email ?? null,
    action: "update",
    entity_type: "providers",
    entity_id: params.id,
    changes: {
      before: { status: existing.status },
      after: { status: data.status },
      reason: data.reason ?? null,
      cancelled_appointments: cancelledAppointments,
    },
  });

  return ok({
    provider: updated,
    cancelled_appointments: cancelledAppointments,
    notifications: { provider_sms: !providerSms.skipped },
  });
}
