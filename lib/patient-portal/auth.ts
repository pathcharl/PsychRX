import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth";
import { getUserRole, dashboardPathForRole } from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabase";
import type { PortalPatient } from "./types";

export async function requirePatientPortalAuth(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/patient-portal/login");

  const role = getUserRole(user);
  if (role !== "patient" && role !== "admin") {
    redirect(dashboardPathForRole(role));
  }
  return user;
}

function normalizePatient(row: Record<string, unknown>): PortalPatient {
  return {
    id: row.id as string,
    first_name: (row.first_name as string) ?? "",
    last_name: (row.last_name as string) ?? "",
    email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null,
    address: (row.address as string) ?? (row.address_line1 as string) ?? null,
    city: (row.city as string) ?? null,
    state: (row.state as string) ?? null,
    zip: (row.zip as string) ?? null,
    insurance_payer: (row.insurance_payer as string) ?? null,
    insurance_primary_payer_name:
      (row.insurance_primary_payer_name as string) ?? null,
    insurance_provider: (row.insurance_provider as string) ?? null,
    insurance_id: (row.insurance_id as string) ?? null,
    insurance_member_id: (row.insurance_member_id as string) ?? null,
    insurance_group: (row.insurance_group as string) ?? null,
    insurance_group_number: (row.insurance_group_number as string) ?? null,
    copay_amount: row.copay_amount != null ? Number(row.copay_amount) : null,
    outstanding_balance:
      row.outstanding_balance != null
        ? Number(row.outstanding_balance)
        : null,
    reschedule_count_this_month:
      Number(row.reschedule_count_this_month ?? 0) || 0,
    primary_provider_id: (row.primary_provider_id as string) ?? null,
    secondary_provider_id: (row.secondary_provider_id as string) ?? null,
    emergency_contact_name: (row.emergency_contact_name as string) ?? null,
    emergency_contact_phone: (row.emergency_contact_phone as string) ?? null,
    emergency_contact_relationship:
      (row.emergency_contact_relationship as string) ?? null,
    preferred_pharmacy: (row.preferred_pharmacy as string) ?? null,
    session_modality_preference:
      (row.session_modality_preference as PortalPatient["session_modality_preference"]) ??
      null,
    sms_opted_out: Boolean(row.sms_opted_out),
    telehealth_consent_signed: Boolean(row.telehealth_consent_signed),
    telehealth_consent_date:
      (row.telehealth_consent_date as string) ??
      (row.audio_only_consent_date as string) ??
      null,
    care_type: (row.care_type as string) ?? null,
  };
}

/**
 * When more than one patients row matches (e.g. a booking created one and an
 * earlier portal login provisioned an empty duplicate), prefer the record that
 * actually has an appointment, then one with a linked provider, then the first.
 */
async function pickPatientWithBooking(
  candidates: Record<string, unknown>[]
): Promise<Record<string, unknown> | null> {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const ids = candidates.map((c) => c.id as string);
  const { data: appts } = await supabaseAdmin
    .from("appointments")
    .select("patient_id, created_at")
    .in("patient_id", ids)
    .order("created_at", { ascending: false })
    .limit(1);

  const apptPatientId = appts?.[0]?.patient_id as string | undefined;
  if (apptPatientId) {
    const withAppt = candidates.find((c) => c.id === apptPatientId);
    if (withAppt) return withAppt;
  }

  const withProvider = candidates.find((c) => c.primary_provider_id);
  return withProvider ?? candidates[0];
}

export async function getPortalPatient(user: User): Promise<PortalPatient | null> {
  // Use the service-role client (not the RLS-bound client) so the lookup never
  // fails on RLS state — a failed lookup here previously caused a second, empty
  // patient record to be provisioned, hiding the patient's real appointments.
  const supabase = supabaseAdmin;

  const { data: byUser } = await supabase
    .from("patients")
    .select("*")
    .eq("user_id", user.id);

  let chosen = await pickPatientWithBooking(
    (byUser ?? []) as Record<string, unknown>[]
  );

  if (!chosen && user.email) {
    const { data: byEmail } = await supabase
      .from("patients")
      .select("*")
      .ilike("email", user.email);
    chosen = await pickPatientWithBooking(
      (byEmail ?? []) as Record<string, unknown>[]
    );
    // Backfill the auth link so future lookups resolve by user_id directly.
    if (chosen && !chosen.user_id) {
      await supabase
        .from("patients")
        .update({ user_id: user.id })
        .eq("id", chosen.id as string);
    }
  }

  return chosen ? normalizePatient(chosen) : null;
}

/** Create or link a patients row after auth signup (no row is created by signUp alone). */
async function provisionPatientProfile(user: User): Promise<PortalPatient | null> {
  const role = getUserRole(user);
  if (role !== "patient" && role !== "admin") return null;

  const fullName = String(user.user_metadata?.full_name ?? "").trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? "Patient";
  const lastName = nameParts.slice(1).join(" ") || "User";

  if (user.email) {
    const { data: byEmail } = await supabaseAdmin
      .from("patients")
      .select("*")
      .eq("email", user.email)
      .maybeSingle();

    if (byEmail) {
      const { data: linked } = await supabaseAdmin
        .from("patients")
        .update({ user_id: user.id })
        .eq("id", byEmail.id)
        .select("*")
        .maybeSingle();
      if (linked) return normalizePatient(linked as Record<string, unknown>);
    }
  }

  const { data: created, error } = await supabaseAdmin
    .from("patients")
    .insert({
      user_id: user.id,
      first_name: firstName,
      last_name: lastName,
      email: user.email,
      status: "active",
    })
    .select("*")
    .single();

  if (error || !created) {
    console.error("[patient-portal] Failed to provision patient profile:", error);
    return null;
  }

  return normalizePatient(created as Record<string, unknown>);
}

/**
 * Resolve the portal patient without redirecting.
 * Returns null when the session is not ready or the profile is missing —
 * the client auth gate handles redirects after its loading timeout.
 */
export const requirePortalPatient = cache(async (): Promise<{
  user: User;
  patient: PortalPatient;
} | null> => {
  const user = await getUser();
  if (!user) return null;

  const role = getUserRole(user);
  if (role !== "patient" && role !== "admin") return null;

  let patient = await getPortalPatient(user);
  if (!patient) {
    patient = await provisionPatientProfile(user);
  }
  if (!patient) return null;
  return { user, patient };
});
