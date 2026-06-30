import { cache } from "react";
import { format, startOfDay, endOfDay, startOfYear } from "date-fns";
import { supabaseAdmin } from "@/lib/supabase";
// Provider portal reads run server-side after requirePortalProvider() has
// authenticated the user and resolved THEIR OWN provider record; every query
// is scoped by provider.id. Use the service-role client so reads work
// regardless of RLS state (the deployed RLS policies currently recurse).
const adminClient = supabaseAdmin;
import type {
  AvailabilityDay,
  CollaborativeAgreement,
  DashboardData,
  DocumentAlert,
  ExternalAlert,
  NextPaymentInfo,
  Phq9Point,
  PortalMessage,
  PortalPatientSummary,
  ProviderDocument,
  ProviderMilestone,
  ProviderPaymentRow,
  ScribeAppointment,
  SessionHistoryRow,
  SidebarBadges,
  TodaySession,
} from "./types";
import type { PortalProvider } from "./types";
import {
  daysUntilExpiry,
  documentStatusColor,
  nextPaymentFriday,
} from "./utils";

function todayRange() {
  const now = new Date();
  return {
    start: startOfDay(now).toISOString(),
    end: endOfDay(now).toISOString(),
    dateStr: format(now, "yyyy-MM-dd"),
  };
}

export const fetchSidebarBadges = cache(async (
  providerId: string
): Promise<SidebarBadges> => {
  const supabase = adminClient;

  // Scope unread messages to THIS provider's conversations only.
  const convIds = await providerConversationIds(providerId);

  const [{ count: notesDue }, unread] = await Promise.all([
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("provider_id", providerId)
      .eq("encounter_submitted", false)
      .neq("status", "cancelled")
      .lte("start_time", new Date().toISOString()),
    convIds.length
      ? supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in("conversation_id", convIds)
          .is("read_at", null)
          .neq("sender_type", "provider")
      : Promise.resolve({ count: 0 }),
  ]);

  return {
    notesDue: notesDue ?? 0,
    unreadMessages: unread.count ?? 0,
  };
});

/** Conversation IDs that include this provider as a participant. */
async function providerConversationIds(providerId: string): Promise<string[]> {
  const { data } = await adminClient
    .from("conversations")
    .select("id")
    .contains("participants", [{ provider_id: providerId }]);
  return (data ?? []).map((c) => c.id as string);
}

/** Conversation IDs shared by a specific patient and provider. */
async function pairConversationIds(
  providerId: string,
  patientId: string
): Promise<string[]> {
  const { data } = await adminClient
    .from("conversations")
    .select("id")
    .contains("participants", [
      { patient_id: patientId },
      { provider_id: providerId },
    ]);
  return (data ?? []).map((c) => c.id as string);
}

export const fetchNextPaymentInfo = cache(async (
  providerId: string
): Promise<NextPaymentInfo> => {
  const supabase = adminClient;

  const { data: pending } = await supabase
    .from("provider_payments")
    .select("provider_amount")
    .eq("provider_id", providerId)
    .eq("transfer_status", "pending")
    .order("payment_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pending?.provider_amount) {
    return {
      amount: Number(pending.provider_amount),
      date: nextPaymentFriday(),
    };
  }

  const weekStart = format(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    "yyyy-MM-dd"
  );
  const { data: encounters } = await supabase
    .from("encounters")
    .select("charge_amount, expected_reimbursement")
    .eq("provider_id", providerId)
    .gte("date_of_service", weekStart)
    .in("claim_status", ["pending", "submitted", "paid"]);

  const gross =
    encounters?.reduce(
      (sum, e) =>
        sum + Number(e.expected_reimbursement ?? e.charge_amount ?? 0),
      0
    ) ?? 0;

  return {
    amount: gross * 0.75,
    date: nextPaymentFriday(),
  };
});

export async function fetchDashboardData(
  provider: PortalProvider
): Promise<DashboardData> {
  const supabase = adminClient;
  const { start, end } = todayRange();

  const [
    celebrationRes,
    sessionsRes,
    alertsRes,
    docsRes,
    badges,
    nextPayment,
  ] = await Promise.all([
    supabase
      .from("provider_payments")
      .select(
        "id, provider_amount, session_count, unique_patients, celebration_level"
      )
      .eq("provider_id", provider.id)
      .eq("celebration_shown", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select(
        `
        id, start_time, appointment_type, session_modality, status,
        telehealth_link,
        patient:patients(id, first_name, last_name, phone, insurance_payer)
      `
      )
      .eq("provider_id", provider.id)
      .gte("start_time", start)
      .lte("start_time", end)
      .order("start_time", { ascending: true }),
    supabase
      .from("inbound_contacts")
      .select("id, channel, intent, content, from_number, created_at, patient_id")
      .eq("provider_id", provider.id)
      .eq("resolved", false)
      .in("intent", ["pharmacy_callback", "prior_auth", "refill", "pa_request"])
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("provider_documents")
      .select("id, document_type, expiry_date")
      .eq("provider_id", provider.id),
    fetchSidebarBadges(provider.id),
    fetchNextPaymentInfo(provider.id),
  ]);

  const todaySessions: TodaySession[] = (sessionsRes.data ?? []).map((row) => {
    const rawPatient = row.patient as Record<string, unknown> | Record<string, unknown>[] | null;
    const patient = Array.isArray(rawPatient) ? rawPatient[0] : rawPatient;
    return {
      id: row.id as string,
      start_time: row.start_time as string,
      appointment_type: row.appointment_type as string | null,
      session_modality: (row.session_modality as string) ?? "video",
      status: row.status as string,
      telehealth_link:
        (row.telehealth_link as string) ?? provider.telehealth_link,
      encounter_submitted: Boolean(
        (row as Record<string, unknown>).encounter_submitted
      ),
      patient: {
        id: (patient?.id as string) ?? "",
        first_name: (patient?.first_name as string) ?? "Patient",
        last_name: (patient?.last_name as string) ?? "",
        phone: (patient?.phone as string) ?? null,
        insurance_payer: (patient?.insurance_payer as string) ?? null,
      },
    };
  });

  const documentAlerts: DocumentAlert[] = (docsRes.data ?? [])
    .map((doc) => {
      const days = daysUntilExpiry(doc.expiry_date as string | null);
      return {
        id: doc.id as string,
        document_type: doc.document_type as string,
        expiry_date: doc.expiry_date as string | null,
        days_until_expiry: days,
        status: documentStatusColor(days),
      };
    })
    .filter((d) => d.status === "yellow" || d.status === "red" || d.status === "grey");

  const externalAlerts: ExternalAlert[] = (alertsRes.data ?? []).map((a) => ({
    id: a.id as string,
    channel: a.channel as string,
    intent: a.intent as string | null,
    content: a.content as string | null,
    from_number: a.from_number as string | null,
    created_at: a.created_at as string,
    patient_id: a.patient_id as string | null,
  }));

  const notesDue = badges.notesDue;
  const fillRate = provider.fill_rate ?? 0;

  const weekStart = format(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    "yyyy-MM-dd"
  );
  const { data: weekEncounters } = await supabase
    .from("encounters")
    .select("expected_reimbursement, charge_amount")
    .eq("provider_id", provider.id)
    .gte("date_of_service", weekStart);

  const nextPaymentEstimate =
    weekEncounters?.reduce(
      (sum, e) =>
        sum + Number(e.expected_reimbursement ?? e.charge_amount ?? 0) * 0.75,
      0
    ) ?? 0;

  return {
    celebration: celebrationRes.data
      ? {
          id: celebrationRes.data.id as string,
          provider_amount: Number(celebrationRes.data.provider_amount),
          session_count: celebrationRes.data.session_count as number | null,
          unique_patients: celebrationRes.data.unique_patients as number | null,
          celebration_level: celebrationRes.data.celebration_level as
            | string
            | null,
        }
      : null,
    todaySessions,
    fillRate,
    notesDue,
    nextPaymentEstimate,
    documentAlerts,
    externalAlerts,
    badges,
    nextPayment,
  };
}

export async function fetchPatients(
  providerId: string,
  filter: "all" | "active" | "no_upcoming" | "high_risk" = "all",
  search = ""
): Promise<PortalPatientSummary[]> {
  const supabase = adminClient;
  const now = new Date().toISOString();

  let query = supabase
    .from("patients")
    .select(
      "id, first_name, last_name, dob, phone, insurance_payer, insurance_verified, no_show_risk, care_type, created_at"
    )
    .or(
      `primary_provider_id.eq.${providerId},secondary_provider_id.eq.${providerId}`
    );

  if (filter === "high_risk") {
    query = query.eq("no_show_risk", "high");
  } else if (filter === "active") {
    query = query.eq("status", "active");
  }

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},insurance_payer.ilike.${term}`
    );
  }

  const { data: patients } = await query.order("last_name");

  const summaries: PortalPatientSummary[] = [];

  for (const p of patients ?? []) {
    const [{ count: sessionCount }, { data: nextAppt }, { data: lastPhq9 }] =
      await Promise.all([
        supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .eq("patient_id", p.id)
          .eq("provider_id", providerId)
          .eq("status", "completed"),
        supabase
          .from("appointments")
          .select("start_time")
          .eq("patient_id", p.id)
          .eq("provider_id", providerId)
          .gte("start_time", now)
          .in("status", ["scheduled", "confirmed"])
          .order("start_time", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("outcome_measures")
          .select("total_score")
          .eq("patient_id", p.id)
          .eq("measure_type", "PHQ9")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    const nextAppointment = (nextAppt?.start_time as string) ?? null;

    if (filter === "no_upcoming" && nextAppointment) continue;

    summaries.push({
      id: p.id as string,
      first_name: p.first_name as string,
      last_name: p.last_name as string,
      dob: p.dob as string | null,
      phone: p.phone as string | null,
      insurance_payer: p.insurance_payer as string | null,
      insurance_verified: Boolean(p.insurance_verified),
      no_show_risk: p.no_show_risk as string | null,
      care_type: p.care_type as string | null,
      next_appointment: nextAppointment,
      session_count: sessionCount ?? 0,
      primary_diagnosis: null,
      treatment_start: p.created_at as string,
      last_phq9_score: lastPhq9?.total_score ?? null,
    });
  }

  return summaries;
}

export async function fetchPatientDetail(
  providerId: string,
  patientId: string
) {
  const supabase = adminClient;

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .or(
      `primary_provider_id.eq.${providerId},secondary_provider_id.eq.${providerId}`
    )
    .maybeSingle();

  if (!patient) return null;

  const now = new Date().toISOString();

  // Only this patient/provider conversation's messages (never a global query).
  const convIds = await pairConversationIds(providerId, patientId);

  const [
    { count: sessionCount },
    { data: upcoming },
    { data: history },
    { data: phq9 },
    { data: messages },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .eq("provider_id", providerId)
      .eq("status", "completed"),
    supabase
      .from("appointments")
      .select("id, start_time, status, session_modality, appointment_type")
      .eq("patient_id", patientId)
      .eq("provider_id", providerId)
      .gte("start_time", now)
      .in("status", ["scheduled", "confirmed"])
      .order("start_time", { ascending: true }),
    supabase
      .from("encounters")
      .select("id, date_of_service, cpt_code, charge_amount, claim_status")
      .eq("patient_id", patientId)
      .eq("provider_id", providerId)
      .order("date_of_service", { ascending: false })
      .limit(20),
    supabase
      .from("outcome_measures")
      .select("total_score, created_at")
      .eq("patient_id", patientId)
      .eq("measure_type", "PHQ9")
      .order("created_at", { ascending: true }),
    convIds.length
      ? supabase
          .from("messages")
          .select("id, content, sender_type, created_at, read_at")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: true })
          .limit(50)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const phq9Trend: Phq9Point[] = (phq9 ?? []).map((m) => ({
    date: format(new Date(m.created_at as string), "MMM d"),
    score: m.total_score as number,
  }));

  const sessionHistory: SessionHistoryRow[] = (history ?? []).map((e) => ({
    id: e.id as string,
    date_of_service: e.date_of_service as string,
    cpt_code: e.cpt_code as string,
    charge_amount: e.charge_amount != null ? Number(e.charge_amount) : null,
    claim_status: (e.claim_status as string) ?? "pending",
  }));

  const portalMessages: PortalMessage[] = (messages ?? []).map((m) => ({
    id: m.id as string,
    content: m.content as string,
    sender_type: m.sender_type as string,
    created_at: m.created_at as string,
    read_at: m.read_at as string | null,
  }));

  return {
    patient,
    sessionCount: sessionCount ?? 0,
    upcoming: upcoming ?? [],
    sessionHistory,
    phq9Trend,
    messages: portalMessages,
    lastPhq9: phq9?.length ? phq9[phq9.length - 1].total_score : null,
  };
}

export async function fetchEarningsData(providerId: string) {
  const supabase = adminClient;
  const ytdStart = format(startOfYear(new Date()), "yyyy-MM-dd");

  const [{ data: payments }, { data: milestones }, { data: ytdEncounters }] =
    await Promise.all([
      supabase
        .from("provider_payments")
        .select("*")
        .eq("provider_id", providerId)
        .order("payment_period_end", { ascending: false }),
      supabase
        .from("provider_milestones")
        .select("*")
        .eq("provider_id", providerId)
        .order("awarded_at", { ascending: false }),
      supabase
        .from("encounters")
        .select("provider_amount, charge_amount, expected_reimbursement")
        .eq("provider_id", providerId)
        .gte("date_of_service", ytdStart)
        .eq("claim_status", "paid"),
    ]);

  const paymentRows: ProviderPaymentRow[] = (payments ?? []).map((p) => ({
    id: p.id as string,
    payment_period_start: p.payment_period_start as string,
    payment_period_end: p.payment_period_end as string,
    gross_collected: Number(p.gross_collected ?? 0),
    psychrx_fee: Number(p.psychrx_fee ?? 0),
    provider_amount: Number(p.provider_amount ?? 0),
    session_count: Number(p.session_count ?? 0),
    transfer_status: (p.transfer_status as string) ?? "pending",
    transferred_at: p.transferred_at as string | null,
  }));

  const ytdTotal =
    ytdEncounters?.reduce(
      (sum, e) =>
        sum +
        Number(
          e.provider_amount ??
            (Number(e.charge_amount ?? e.expected_reimbursement ?? 0) * 0.75)
        ),
      0
    ) ?? 0;

  const { data: provider } = await supabase
    .from("providers")
    .select("all_time_earnings, all_time_sessions")
    .eq("id", providerId)
    .single();

  const milestoneRows: ProviderMilestone[] = (milestones ?? []).map((m) => ({
    id: m.id as string,
    milestone_id: m.milestone_id as string,
    milestone_title: m.milestone_title as string | null,
    awarded_at: m.awarded_at as string,
  }));

  const weekStart = format(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    "yyyy-MM-dd"
  );
  const { data: currentEncounters } = await supabase
    .from("encounters")
    .select("charge_amount, expected_reimbursement")
    .eq("provider_id", providerId)
    .gte("date_of_service", weekStart);

  const currentGross =
    currentEncounters?.reduce(
      (sum, e) =>
        sum + Number(e.expected_reimbursement ?? e.charge_amount ?? 0),
      0
    ) ?? 0;

  return {
    currentPeriod: {
      sessions: currentEncounters?.length ?? 0,
      gross: currentGross,
      psychrxFee: currentGross * 0.25,
      providerAmount: currentGross * 0.75,
    },
    paymentHistory: paymentRows,
    milestones: milestoneRows,
    ytdTotal,
    allTimeTotal: Number(provider?.all_time_earnings ?? 0),
    allTimeSessions: Number(provider?.all_time_sessions ?? 0),
  };
}

export async function fetchAvailability(
  providerId: string
): Promise<{
  days: AvailabilityDay[];
  blockedDates: { blocked_date: string; reason: string | null }[];
  acceptsNewPatients: boolean;
}> {
  const supabase = adminClient;

  const [{ data: templates }, { data: blocked }, { data: provider }] =
    await Promise.all([
      supabase
        .from("availability_templates")
        .select("*")
        .eq("provider_id", providerId),
      supabase
        .from("blocked_dates")
        .select("blocked_date, reason")
        .eq("provider_id", providerId)
        .gte("blocked_date", format(new Date(), "yyyy-MM-dd"))
        .order("blocked_date"),
      supabase
        .from("providers")
        .select("accepts_new_patients")
        .eq("id", providerId)
        .single(),
    ]);

  const days: AvailabilityDay[] = Array.from({ length: 7 }, (_, dow) => {
    const tmpl = templates?.find((t) => t.day_of_week === dow);
    return {
      day_of_week: dow,
      enabled: tmpl?.is_active ?? false,
      start_time: (tmpl?.start_time as string)?.slice(0, 5) ?? "09:00",
      end_time: (tmpl?.end_time as string)?.slice(0, 5) ?? "17:00",
      slot_duration_minutes: Number(tmpl?.slot_duration_minutes ?? 60),
      buffer_minutes: 10,
      max_sessions: 8,
      template_id: (tmpl?.id as string) ?? null,
    };
  });

  return {
    days,
    blockedDates: (blocked ?? []).map((b) => ({
      blocked_date: b.blocked_date as string,
      reason: b.reason as string | null,
    })),
    acceptsNewPatients: provider?.accepts_new_patients !== false,
  };
}

export async function fetchDocuments(providerId: string) {
  const supabase = adminClient;

  const [{ data: docs }, { data: agreements }, { data: contracts }] =
    await Promise.all([
      supabase
        .from("provider_documents")
        .select("*")
        .eq("provider_id", providerId),
      supabase
        .from("collaborative_agreements")
        .select("*")
        .eq("pmhnp_id", providerId)
        .order("expiry_date", { ascending: false })
        .limit(1),
      supabase
        .from("contracts")
        .select("contract_kind, signed_at, status")
        .eq("provider_id", providerId)
        .in("contract_kind", ["ica", "baa"]),
    ]);

  const documents: ProviderDocument[] = (docs ?? []).map((d) => ({
    id: d.id as string,
    document_type: d.document_type as string,
    file_url: d.file_url as string | null,
    expiry_date: d.expiry_date as string | null,
    verified: Boolean(d.verified),
  }));

  const agreement: CollaborativeAgreement | null = agreements?.[0]
    ? {
        id: agreements[0].id as string,
        md_name: agreements[0].md_name as string | null,
        expiry_date: agreements[0].expiry_date as string | null,
        status: agreements[0].status as string,
      }
    : null;

  const icaSigned = contracts?.some(
    (c) => c.contract_kind === "ica" && c.status === "signed"
  );
  const baaSigned = contracts?.some(
    (c) => c.contract_kind === "baa" && c.status === "signed"
  );

  return { documents, agreement, icaSigned: !!icaSigned, baaSigned: !!baaSigned };
}

export async function fetchScribeAppointments(
  providerId: string
): Promise<ScribeAppointment[]> {
  const supabase = adminClient;
  // Sessions are documentable once their scheduled time has passed and a note
  // hasn't been submitted yet. We look back 7 days so a provider can catch up,
  // rather than requiring a separate "mark completed" step.
  const now = new Date();
  const lookback = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const { data } = await supabase
    .from("appointments")
    .select(
      `
      id, patient_id, appointment_type, session_modality, start_time,
      patient:patients(first_name, last_name)
    `
    )
    .eq("provider_id", providerId)
    .eq("encounter_submitted", false)
    .neq("status", "cancelled")
    .gte("start_time", lookback.toISOString())
    .lte("start_time", now.toISOString())
    .order("start_time", { ascending: true });

  return (data ?? []).map((row) => {
    const rawPatient = row.patient as Record<string, unknown> | Record<string, unknown>[] | null;
    const patient = Array.isArray(rawPatient) ? rawPatient[0] : rawPatient;
    return {
      id: row.id as string,
      patient_id: row.patient_id as string,
      patient_name: `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim(),
      appointment_type: row.appointment_type as string | null,
      session_modality: (row.session_modality as string) ?? "video",
      start_time: row.start_time as string,
    };
  });
}

export async function fetchScheduleAppointments(providerId: string) {
  const supabase = adminClient;
  const now = new Date().toISOString();
  const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("appointments")
    .select(
      `
      id, start_time, status, appointment_type, session_modality,
      patient:patients(first_name, last_name, insurance_payer)
    `
    )
    .eq("provider_id", providerId)
    .gte("start_time", now)
    .lte("start_time", twoWeeks)
    .in("status", ["scheduled", "confirmed"])
    .order("start_time", { ascending: true });

  return data ?? [];
}

export async function fetchProviderMessages(providerId: string) {
  const supabase = adminClient;

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, title, last_message_at, participants")
    .contains("participants", [{ provider_id: providerId }])
    .order("last_message_at", { ascending: false })
    .limit(20);

  // No conversations → empty (never fall back to a global message query).
  if (!conversations?.length) {
    return { conversations: [], messages: [] };
  }

  const convIds = conversations.map((c) => c.id);
  const { data: messages } = await supabase
    .from("messages")
    .select("id, content, sender_type, created_at, read_at, conversation_id")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: false })
    .limit(50);

  return { conversations, messages: messages ?? [] };
}
