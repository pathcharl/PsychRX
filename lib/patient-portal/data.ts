import { supabaseAdmin } from "@/lib/supabase";
// All reads below run server-side after the caller has authenticated the user
// and resolved THEIR OWN patient record; every query is scoped by patient.id.
// We use the service-role client so these reads work regardless of RLS state.
const adminClient = supabaseAdmin;
import type {
  PastAppointment,
  PortalAppointment,
  PortalAppointmentsData,
  PortalDashboardData,
  PortalMessage,
  PortalPatient,
  PortalProvider,
  PortalSuperbill,
} from "./types";
import {
  getAppointmentTime,
  getSessionModality,
  getTelehealthLink,
} from "./utils";

function normalizeProvider(row: Record<string, unknown>): PortalProvider {
  const specialties = row.specialties as string[] | undefined;
  const specialty = row.specialty as string | undefined;
  return {
    id: row.id as string,
    first_name: (row.first_name as string) ?? "Provider",
    last_name: (row.last_name as string) ?? "",
    credentials: (row.credentials as string) ?? null,
    specialties: specialties?.length
      ? specialties
      : specialty
        ? [specialty]
        : [],
    telehealth_link: (row.telehealth_link as string) ?? null,
  };
}

function normalizeAppointment(
  row: Record<string, unknown>,
  provider?: Record<string, unknown> | null
): PortalAppointment {
  const providerRow = (row.provider as Record<string, unknown>) ?? provider;
  return {
    id: row.id as string,
    patient_id: row.patient_id as string,
    provider_id: row.provider_id as string,
    scheduled_at: getAppointmentTime(row),
    duration_minutes: Number(row.duration_minutes ?? 60),
    session_modality: getSessionModality(row),
    telehealth_link: getTelehealthLink(row, providerRow),
    status: (row.status as string) ?? "scheduled",
    provider: providerRow ? normalizeProvider(providerRow) : null,
  };
}

async function fetchProvidersByIds(ids: string[]): Promise<PortalProvider[]> {
  if (ids.length === 0) return [];
  const supabase = adminClient;
  const { data } = await supabase
    .from("providers")
    .select("id, first_name, last_name, credentials, specialties, telehealth_link")
    .in("id", ids);

  return (data ?? []).map((p) => normalizeProvider(p as Record<string, unknown>));
}

export async function checkQuestionnaireDue(
  patient: PortalPatient
): Promise<boolean> {
  const supabase = adminClient;
  const interval =
    patient.care_type === "therapy" || patient.care_type === "combined"
      ? 4
      : 3;

  const { count: sessionCount } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("patient_id", patient.id)
    .eq("status", "completed");

  const { data: lastMeasure } = await supabase
    .from("outcome_measures")
    .select("created_at")
    .eq("patient_id", patient.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sessionCount) return false;

  if (!lastMeasure) {
    return sessionCount >= interval;
  }

  const { count: sinceLast } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("patient_id", patient.id)
    .eq("status", "completed")
    .gt("created_at", lastMeasure.created_at);

  return (sinceLast ?? 0) >= interval;
}

export async function fetchRecentMessages(
  patientId: string
): Promise<PortalMessage[]> {
  const supabase = adminClient;

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id")
    .contains("participants", [{ patient_id: patientId }])
    .limit(5);

  // No conversation yet → no messages (never fall back to a global query,
  // which would leak other patients' messages).
  if (!conversations?.length) return [];

  const conversationIds = conversations.map((c) => c.id);
  const { data: messages } = await supabase
    .from("messages")
    .select("id, content, sender_type, created_at, message_type, read_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false })
    .limit(2);

  return (messages ?? []).map((m) => ({
    id: m.id as string,
    content: m.content as string,
    sender_type: (m.sender_type === "provider" ? "provider" : "patient") as
      | "patient"
      | "provider",
    created_at: m.created_at as string,
    message_type: (m.message_type as string) ?? "general",
    read_at: (m.read_at as string) ?? null,
  }));
}

/**
 * Provider to message. We prefer the provider on the patient's most recently
 * booked appointment so messaging always targets the provider they actually
 * booked with (a stale primary_provider_id could otherwise point elsewhere).
 * Falls back to the assigned primary/secondary provider.
 */
export async function resolveMessagingProviderId(
  patient: PortalPatient
): Promise<string | null> {
  const { data: appt } = await supabaseAdmin
    .from("appointments")
    .select("provider_id")
    .eq("patient_id", patient.id)
    .not("provider_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (appt?.provider_id) return appt.provider_id as string;
  if (patient.primary_provider_id) return patient.primary_provider_id;
  if (patient.secondary_provider_id) return patient.secondary_provider_id;
  return null;
}

export async function fetchOutstandingBalance(
  patientId: string
): Promise<number | null> {
  const supabase = adminClient;

  const { data: claims } = await supabase
    .from("insurance_claims")
    .select("patient_responsibility, paid_amount, billed_amount")
    .eq("patient_id", patientId)
    .in("status", ["submitted", "accepted", "partially_paid", "denied"]);

  if (claims?.length) {
    const total = claims.reduce((sum, c) => {
      const owed =
        Number(c.patient_responsibility ?? 0) -
        Number(c.paid_amount ?? 0);
      return sum + Math.max(0, owed);
    }, 0);
    return total > 0 ? total : null;
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("amount, status")
    .eq("patient_id", patientId)
    .eq("status", "pending");

  if (payments?.length) {
    return payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  }

  return null;
}

export async function fetchDashboardData(
  patient: PortalPatient
): Promise<Omit<PortalDashboardData, "patient">> {
  const supabase = adminClient;
  const now = new Date().toISOString();

  const { data: upcomingRows } = await supabase
    .from("appointments")
    .select(
      `
      *,
      provider:providers(id, first_name, last_name, credentials, specialties, telehealth_link)
    `
    )
    .eq("patient_id", patient.id)
    .in("status", ["scheduled", "confirmed"])
    .gte("scheduled_start", now)
    .order("scheduled_start", { ascending: true })
    .limit(1);

  let nextAppointment: PortalAppointment | null = null;
  if (upcomingRows?.[0]) {
    nextAppointment = normalizeAppointment(
      upcomingRows[0] as Record<string, unknown>
    );
  } else {
    const alt = await supabase
      .from("appointments")
      .select(
        `
        *,
        provider:providers(id, first_name, last_name, credentials, specialties, telehealth_link)
      `
      )
      .eq("patient_id", patient.id)
      .in("status", ["scheduled", "confirmed"])
      .gte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(1);
    if (alt.data?.[0]) {
      nextAppointment = normalizeAppointment(
        alt.data[0] as Record<string, unknown>
      );
    }
  }

  const providerIds = [
    patient.primary_provider_id,
    patient.secondary_provider_id,
  ].filter(Boolean) as string[];

  let careTeam = await fetchProvidersByIds(providerIds.slice(0, 2));
  if (careTeam.length === 0 && nextAppointment?.provider) {
    careTeam = [nextAppointment.provider];
  }

  const [recentMessages, questionnaireDue, outstandingBalance] =
    await Promise.all([
      fetchRecentMessages(patient.id),
      checkQuestionnaireDue(patient),
      fetchOutstandingBalance(patient.id),
    ]);

  const payer =
    patient.insurance_payer ||
    patient.insurance_primary_payer_name ||
    patient.insurance_provider ||
    "Not on file";

  return {
    nextAppointment,
    careTeam,
    recentMessages,
    questionnaireDue,
    billing: {
      payer,
      copay: patient.copay_amount,
      outstandingBalance: outstandingBalance ?? patient.outstanding_balance,
    },
  };
}

export async function fetchAppointmentsData(
  patient: PortalPatient
): Promise<Omit<PortalAppointmentsData, "patient">> {
  const supabase = adminClient;
  const now = new Date().toISOString();

  const selectQuery = `
    *,
    provider:providers(id, first_name, last_name, credentials, specialties, telehealth_link)
  `;

  let { data: upcoming } = await supabase
    .from("appointments")
    .select(selectQuery)
    .eq("patient_id", patient.id)
    .in("status", ["scheduled", "confirmed"])
    .gte("scheduled_start", now)
    .order("scheduled_start", { ascending: true });

  if (!upcoming?.length) {
    const alt = await supabase
      .from("appointments")
      .select(selectQuery)
      .eq("patient_id", patient.id)
      .in("status", ["scheduled", "confirmed"])
      .gte("scheduled_at", now)
      .order("scheduled_at", { ascending: true });
    upcoming = alt.data;
  }

  let { data: pastRows } = await supabase
    .from("appointments")
    .select(selectQuery)
    .eq("patient_id", patient.id)
    .in("status", ["completed", "no_show"])
    .lt("scheduled_start", now)
    .order("scheduled_start", { ascending: false })
    .limit(20);

  if (!pastRows?.length) {
    const alt = await supabase
      .from("appointments")
      .select(selectQuery)
      .eq("patient_id", patient.id)
      .in("status", ["completed", "no_show"])
      .lt("scheduled_at", now)
      .order("scheduled_at", { ascending: false })
      .limit(20);
    pastRows = alt.data;
  }

  const pastIds = (pastRows ?? []).map((r) => r.id as string);
  const encounterMap = new Map<
    string,
    { charge: number | null; paid: number | null; owed: number | null }
  >();

  if (pastIds.length) {
    const { data: encounters } = await supabase
      .from("encounters")
      .select("appointment_id, charge_amount, paid_amount")
      .in("appointment_id", pastIds);

    for (const enc of encounters ?? []) {
      if (enc.appointment_id) {
        const charge = enc.charge_amount != null ? Number(enc.charge_amount) : null;
        const paid = enc.paid_amount != null ? Number(enc.paid_amount) : null;
        encounterMap.set(enc.appointment_id as string, {
          charge,
          paid,
          owed: charge != null && paid != null ? Math.max(0, charge - paid) : null,
        });
      }
    }
  }

  const past: PastAppointment[] = (pastRows ?? []).map((row) => {
    const appt = normalizeAppointment(row as Record<string, unknown>);
    const billing = encounterMap.get(appt.id);
    return {
      id: appt.id,
      scheduled_at: appt.scheduled_at,
      session_modality: appt.session_modality,
      provider: appt.provider,
      amount_billed: billing?.charge ?? null,
      insurance_paid: billing?.paid ?? null,
      patient_owed: billing?.owed ?? null,
      superbill_id: null,
    };
  });

  return {
    upcoming: (upcoming ?? []).map((row) =>
      normalizeAppointment(row as Record<string, unknown>)
    ),
    past,
  };
}

export async function fetchSuperbills(
  patientId: string
): Promise<PortalSuperbill[]> {
  const supabase = adminClient;
  const { data } = await supabase
    .from("patient_documents")
    .select("id, encounter_id, file_url, signed_url, date_of_service")
    .eq("patient_id", patientId)
    .eq("document_type", "superbill")
    .order("date_of_service", { ascending: false });

  return (data ?? []).map((d) => ({
    id: d.id as string,
    encounter_id: (d.encounter_id as string) ?? null,
    date_of_service: (d.date_of_service as string) ?? "",
    file_url: (d.file_url as string) ?? null,
    signed_url: (d.signed_url as string) ?? null,
  }));
}

export async function fetchAllMessages(
  patientId: string
): Promise<PortalMessage[]> {
  const supabase = adminClient;

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id")
    .contains("participants", [{ patient_id: patientId }]);

  // No conversation yet → empty thread (never query messages globally, which
  // would expose other patients' messages).
  if (!conversations?.length) return [];

  const { data } = await supabase
    .from("messages")
    .select("id, content, sender_type, created_at, message_type, read_at")
    .in(
      "conversation_id",
      conversations.map((c) => c.id)
    )
    .order("created_at", { ascending: true })
    .limit(100);

  return (data ?? []).map((m) => ({
    id: m.id as string,
    content: m.content as string,
    sender_type: (m.sender_type === "provider" ? "provider" : "patient") as
      | "patient"
      | "provider",
    created_at: m.created_at as string,
    message_type: (m.message_type as string) ?? "general",
    read_at: (m.read_at as string) ?? null,
  }));
}
