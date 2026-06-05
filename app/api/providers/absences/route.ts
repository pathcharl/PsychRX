import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody, dbError } from "@/lib/api";
import { sendPatientNotification, sendProviderAlert, sendSms } from "@/lib/sms";

export const runtime = "nodejs";

const ACTIVE_STATUSES = ["scheduled", "confirmed", "rescheduled"];
const OWNER_PHONE = process.env.OWNER_PHONE ?? "";
const BILLING_COORDINATOR_PHONE = process.env.BILLING_COORDINATOR_PHONE ?? "";

const absenceSchema = z.object({
  provider_id: z.string().uuid(),
  absence_type: z.enum(["sick", "vacation", "emergency"]),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

interface ProviderRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  specialty: string | null;
  available: boolean | null;
}

interface PatientRow {
  id: string;
  first_name: string | null;
  phone: string | null;
}

/** Find available providers who can cover (same specialty preferred). */
async function findCoverageProviders(
  absentProviderId: string,
  specialty: string | null
): Promise<ProviderRow[]> {
  let query = supabaseAdmin
    .from("providers")
    .select("id, first_name, last_name, phone, specialty, available")
    .eq("status", "active")
    .eq("available", true)
    .eq("compliance_suspended", false)
    .neq("id", absentProviderId);

  if (specialty) query = query.eq("specialty", specialty);

  const { data } = await query.limit(5);
  return (data as ProviderRow[] | null) ?? [];
}

/**
 * POST /api/providers/absences — report an absence, trigger coverage workflow,
 * notify affected patients, and block dates.
 */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, absenceSchema);
  if (error) return error;

  const { data: providerRow } = await supabaseAdmin
    .from("providers")
    .select("id, first_name, last_name, phone, specialty, available")
    .eq("id", data.provider_id)
    .maybeSingle();
  const provider = providerRow as ProviderRow | null;
  if (!provider) return fail("Provider not found", 404);

  const startIso = `${data.start_date}T00:00:00.000Z`;
  const endIso = `${data.end_date}T23:59:59.999Z`;

  // Find affected appointments in the absence window.
  const { data: affected } = await supabaseAdmin
    .from("appointments")
    .select("id, patient_id, scheduled_start, status")
    .eq("provider_id", data.provider_id)
    .gte("scheduled_start", startIso)
    .lte("scheduled_start", endIso)
    .in("status", ACTIVE_STATUSES)
    .order("scheduled_start", { ascending: true });

  const affectedIds = (affected ?? []).map((a: { id: string }) => a.id);

  // Mark provider unavailable.
  await supabaseAdmin
    .from("providers")
    .update({
      available: false,
      unavailable_reason: data.absence_type,
      unavailable_since: new Date().toISOString(),
    })
    .eq("id", data.provider_id);

  // Find coverage providers.
  const coverageProviders = await findCoverageProviders(
    data.provider_id,
    provider.specialty
  );
  const coverageIds = coverageProviders.map((p) => p.id);

  // Record the absence.
  const { data: absence, error: absenceErr } = await supabaseAdmin
    .from("provider_absences")
    .insert({
      provider_id: data.provider_id,
      absence_type: data.absence_type,
      start_date: data.start_date,
      end_date: data.end_date,
      status: "active",
      coverage_provider_ids: coverageIds,
      affected_appointment_ids: affectedIds,
      notes: data.notes ?? null,
    })
    .select()
    .single();

  if (absenceErr) return dbError(absenceErr);

  // Block each date in the range.
  const blockedDates: string[] = [];
  const start = new Date(data.start_date);
  const end = new Date(data.end_date);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    blockedDates.push(d.toISOString().slice(0, 10));
  }
  if (blockedDates.length) {
    await supabaseAdmin.from("blocked_dates").upsert(
      blockedDates.map((blocked_date) => ({
        provider_id: data.provider_id,
        blocked_date,
        reason: `${data.absence_type} absence`,
      })),
      { onConflict: "provider_id,blocked_date" }
    );
  }

  // Cancel open slots in the absence window.
  await supabaseAdmin
    .from("provider_slots")
    .update({ status: "cancelled" })
    .eq("provider_id", data.provider_id)
    .eq("status", "open")
    .gte("start_time", startIso)
    .lte("start_time", endIso);

  // Notify affected patients.
  const patientIds = Array.from(
    new Set(
      (affected ?? [])
        .map((a: { patient_id: string }) => a.patient_id)
        .filter(Boolean)
    )
  );
  for (const patientId of patientIds) {
    const { data: patientRow } = await supabaseAdmin
      .from("patients")
      .select("id, first_name, phone")
      .eq("id", patientId)
      .maybeSingle();
    const patient = patientRow as PatientRow | null;
    if (patient) {
      await sendPatientNotification(
        patient,
        `We're sorry — your provider is unavailable (${data.absence_type}) and your ` +
          `upcoming appointment may need to be rescheduled. Our team is arranging coverage ` +
          `and will contact you shortly.`
      ).catch(() => undefined);
    }
  }

  // Alert office + coverage providers.
  const providerName =
    [provider.first_name, provider.last_name].filter(Boolean).join(" ") || "A provider";
  const alert =
    `COVERAGE NEEDED: ${providerName} reported ${data.absence_type} ` +
    `(${data.start_date} to ${data.end_date}). ` +
    `${affectedIds.length} appointment(s) affected. ` +
    `Coverage options: ${coverageProviders.map((p) => p.first_name).join(", ") || "none found"}.`;

  for (const phone of [OWNER_PHONE, BILLING_COORDINATOR_PHONE]) {
    if (phone) {
      await sendSms(phone, alert, { recipientType: "owner", subject: "Coverage needed" });
    }
  }

  for (const cover of coverageProviders) {
    await sendProviderAlert(
      cover,
      `Coverage request: ${providerName} is out (${data.absence_type}). ` +
        `Can you cover ${affectedIds.length} session(s) between ${data.start_date} and ${data.end_date}?`
    ).catch(() => undefined);
  }

  await sendProviderAlert(
    provider,
    `Your ${data.absence_type} absence (${data.start_date} to ${data.end_date}) has been recorded. ` +
      `We've notified ${affectedIds.length} patient(s) and alerted the office for coverage.`
  ).catch(() => undefined);

  return ok(
    {
      absence,
      affected_appointments: affectedIds.length,
      coverage_providers: coverageProviders.map((p) => ({
        id: p.id,
        name: [p.first_name, p.last_name].filter(Boolean).join(" "),
      })),
    },
    201
  );
}
