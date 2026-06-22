import { cache } from "react";
import { startOfWeek, startOfMonth, subHours, addHours } from "date-fns";
import { supabaseAdmin } from "@/lib/supabase";
import { toFillPercent } from "./utils";
import type {
  AbsenceRow,
  AdminDashboardData,
  AdminMetrics,
  AdminPatientRow,
  AdminProviderRow,
  AuditLogRow,
  BalanceDecision,
  BalancePageData,
  BillingCenter,
  CampaignMetrics,
  ComplianceRow,
  CoverageDecisionRow,
  CoveragePageData,
  PaymentFeedItem,
  PipelineProvider,
  PipelineStage,
  ScraperQueueRow,
  SessionMonitorRow,
  SessionMonitorStatus,
} from "./types";

const DAILY_FAX_LIMIT = 50;

function providerName(row: Record<string, unknown> | null | undefined): string {
  if (!row) return "Unknown";
  const first = (row.first_name as string) ?? "";
  const last = (row.last_name as string) ?? "";
  const full = `${first} ${last}`.trim();
  return full || "Unknown";
}

function patientInitialName(
  row: Record<string, unknown> | null | undefined
): string {
  if (!row) return "Unknown";
  const first = (row.first_name as string) ?? "";
  const last = (row.last_name as string) ?? "";
  const initial = last.charAt(0).toUpperCase();
  return initial ? `${first} ${initial}.` : first || "Unknown";
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error("[admin/data] query failed:", err);
    return fallback;
  }
}

export const fetchAdminMetrics = cache(async (): Promise<AdminMetrics> => {
  return safe(async () => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();

    const [providersRes, patientsRes, sessionsRes, encountersRes] =
      await Promise.all([
        supabaseAdmin
          .from("providers")
          .select("id, provider_type, status")
          .eq("status", "active"),
        supabaseAdmin
          .from("patients")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabaseAdmin
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .gte("start_time", weekStart),
        supabaseAdmin
          .from("encounters")
          .select("charge_amount, expected_reimbursement, paid_amount")
          .gte("date_of_service", weekStart.slice(0, 10)),
      ]);

    const providersByType: Record<string, number> = {};
    for (const p of providersRes.data ?? []) {
      const type = (p.provider_type as string) ?? "other";
      providersByType[type] = (providersByType[type] ?? 0) + 1;
    }

    const revenueThisWeek = (encountersRes.data ?? []).reduce(
      (sum, e) =>
        sum +
        Number(e.paid_amount ?? e.expected_reimbursement ?? e.charge_amount ?? 0),
      0
    );

    return {
      activeProviders: providersRes.data?.length ?? 0,
      providersByType,
      activePatients: patientsRes.count ?? 0,
      sessionsThisWeek: sessionsRes.count ?? 0,
      revenueThisWeek,
    };
  }, {
    activeProviders: 0,
    providersByType: {},
    activePatients: 0,
    sessionsThisWeek: 0,
    revenueThisWeek: 0,
  });
});

export const fetchRecentPayments = cache(async (): Promise<PaymentFeedItem[]> => {
  return safe(async () => {
    const { data } = await supabaseAdmin
      .from("provider_payments")
      .select(
        `id, provider_id, provider_amount, session_count, created_at, transferred_at,
         provider:providers(first_name, last_name)`
      )
      .order("created_at", { ascending: false })
      .limit(10);

    return (data ?? []).map((row) => {
      const rawProvider = row.provider as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | null;
      const provider = Array.isArray(rawProvider) ? rawProvider[0] : rawProvider;
      return {
        id: row.id as string,
        provider_id: (row.provider_id as string) ?? null,
        provider_name: providerName(provider),
        provider_amount: Number(row.provider_amount ?? 0),
        session_count: row.session_count != null ? Number(row.session_count) : null,
        created_at: row.created_at as string,
        transferred_at: (row.transferred_at as string) ?? null,
      };
    });
  }, []);
});

function deriveSessionStatus(row: Record<string, unknown>): SessionMonitorStatus {
  const status = (row.status as string) ?? "scheduled";
  if (status === "completed") return "completed";
  if (status === "no_show") return "no_show";
  if (row.session_started_at) return "in_progress";
  const start = new Date(row.start_time as string).getTime();
  if (!Number.isNaN(start) && start < Date.now()) return "in_progress";
  return "upcoming";
}

export const fetchSessionMonitor = cache(async (): Promise<SessionMonitorRow[]> => {
  return safe(async () => {
    const from = subHours(new Date(), 1).toISOString();
    const to = addHours(new Date(), 3).toISOString();

    const { data } = await supabaseAdmin
      .from("appointments")
      .select(
        `id, start_time, status, session_modality, session_started_at,
         patient:patients(first_name, last_name),
         provider:providers(first_name, last_name)`
      )
      .gte("start_time", from)
      .lte("start_time", to)
      .order("start_time", { ascending: true })
      .limit(50);

    return (data ?? []).map((row) => {
      const rawP = row.patient as Record<string, unknown> | Record<string, unknown>[] | null;
      const patient = Array.isArray(rawP) ? rawP[0] : rawP;
      const rawPr = row.provider as Record<string, unknown> | Record<string, unknown>[] | null;
      const provider = Array.isArray(rawPr) ? rawPr[0] : rawPr;
      return {
        id: row.id as string,
        start_time: row.start_time as string,
        patient_name: patientInitialName(patient),
        provider_name: providerName(provider),
        status: deriveSessionStatus(row as Record<string, unknown>),
        modality: (row.session_modality as string) ?? "video",
      };
    });
  }, []);
});

function deriveStage(
  status: string,
  onboardingStage: number | null,
  contractSigned: boolean,
  stripeReady: boolean
): PipelineStage {
  if (status === "active") return "active";
  if (stripeReady) return "stripe";
  if (contractSigned) return "contract";
  if (onboardingStage != null && onboardingStage >= 2) return "documents";
  return "applied";
}

export const fetchPipeline = cache(async (): Promise<PipelineProvider[]> => {
  return safe(async () => {
    const { data } = await supabaseAdmin
      .from("providers")
      .select(
        `id, first_name, last_name, provider_type, status, contract_signed,
         stripe_onboarding_complete, updated_at,
         onboarding:provider_onboarding_status(current_stage, updated_at)`
      )
      .neq("status", "inactive")
      .limit(100);

    return (data ?? []).map((row) => {
      const rawOnb = row.onboarding as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | null;
      const onboarding = Array.isArray(rawOnb) ? rawOnb[0] : rawOnb;
      const stageUpdatedAt =
        (onboarding?.updated_at as string) ?? (row.updated_at as string);
      const daysInStage = stageUpdatedAt
        ? Math.floor(
            (Date.now() - new Date(stageUpdatedAt).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;
      const stage = deriveStage(
        (row.status as string) ?? "pending",
        (onboarding?.current_stage as number) ?? null,
        Boolean(row.contract_signed),
        Boolean(row.stripe_onboarding_complete)
      );
      return {
        id: row.id as string,
        name: providerName(row as Record<string, unknown>),
        provider_type: (row.provider_type as string) ?? null,
        stage,
        days_in_stage: daysInStage,
        stuck: stage !== "active" && daysInStage > 7,
      };
    });
  }, []);
});

export const fetchBillingCenter = cache(async (): Promise<BillingCenter> => {
  return safe(async () => {
    const monthStart = startOfMonth(new Date()).toISOString();

    const [pendingRes, paidRes, deniedRes, totalRes] = await Promise.all([
      supabaseAdmin
        .from("insurance_claims")
        .select("id", { count: "exact", head: true })
        .in("status", ["draft", "submitted", "accepted"]),
      supabaseAdmin
        .from("insurance_claims")
        .select("paid_amount, submitted_at, adjudicated_at")
        .eq("status", "paid")
        .gte("adjudicated_at", monthStart),
      supabaseAdmin
        .from("insurance_claims")
        .select("id", { count: "exact", head: true })
        .in("status", ["denied", "rejected"]),
      supabaseAdmin
        .from("insurance_claims")
        .select("id", { count: "exact", head: true }),
    ]);

    const paidRows = paidRes.data ?? [];
    const claimsPaidThisMonth = paidRows.reduce(
      (sum, c) => sum + Number(c.paid_amount ?? 0),
      0
    );

    const daysList = paidRows
      .map((c) => {
        if (!c.submitted_at || !c.adjudicated_at) return null;
        const diff =
          new Date(c.adjudicated_at).getTime() -
          new Date(c.submitted_at).getTime();
        return diff / (1000 * 60 * 60 * 24);
      })
      .filter((d): d is number => d != null && d >= 0);
    const avgDaysToPayment = daysList.length
      ? Math.round(daysList.reduce((a, b) => a + b, 0) / daysList.length)
      : 0;

    const denied = deniedRes.count ?? 0;
    const total = totalRes.count ?? 0;
    const denialRate = total > 0 ? Math.round((denied / total) * 100) : 0;

    return {
      claimsPending: pendingRes.count ?? 0,
      claimsPaidThisMonth,
      denialRate,
      avgDaysToPayment,
    };
  }, {
    claimsPending: 0,
    claimsPaidThisMonth: 0,
    denialRate: 0,
    avgDaysToPayment: 0,
  });
});

async function fetchAllocation(): Promise<{
  referral: number;
  recruit: number;
}> {
  return safe(async () => {
    const { data } = await supabaseAdmin
      .from("campaign_config")
      .select("config_key, config_value")
      .in("config_key", ["allocation_referral_pct", "allocation_recruit_pct"]);

    let referral = 50;
    let recruit = 50;
    for (const row of data ?? []) {
      const val = Number(row.config_value);
      if (row.config_key === "allocation_referral_pct" && !Number.isNaN(val))
        referral = val;
      if (row.config_key === "allocation_recruit_pct" && !Number.isNaN(val))
        recruit = val;
    }
    return { referral, recruit };
  }, { referral: 50, recruit: 50 });
}

export const fetchCampaignMetrics = cache(async (): Promise<CampaignMetrics> => {
  return safe(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = startOfMonth(new Date()).toISOString().slice(0, 10);

    const [faxesRes, referralRes, recruitRes, allocation] = await Promise.all([
      supabaseAdmin
        .from("daily_send_log")
        .select("id", { count: "exact", head: true })
        .eq("channel", "fax")
        .gte("send_date", today),
      supabaseAdmin
        .from("daily_send_log")
        .select("id", { count: "exact", head: true })
        .eq("campaign", "referral_outreach")
        .gte("send_date", monthStart),
      supabaseAdmin
        .from("daily_send_log")
        .select("id", { count: "exact", head: true })
        .eq("campaign", "provider_recruit")
        .gte("send_date", monthStart),
      fetchAllocation(),
    ]);

    return {
      faxesSentToday: faxesRes.count ?? 0,
      dailyFaxLimit: DAILY_FAX_LIMIT,
      referralSourcesContacted: referralRes.count ?? 0,
      providerRecruitsContacted: recruitRes.count ?? 0,
      allocationReferralPct: allocation.referral,
      allocationRecruitPct: allocation.recruit,
    };
  }, {
    faxesSentToday: 0,
    dailyFaxLimit: DAILY_FAX_LIMIT,
    referralSourcesContacted: 0,
    providerRecruitsContacted: 0,
    allocationReferralPct: 50,
    allocationRecruitPct: 50,
  });
});

export const fetchFillRate = cache(async (): Promise<number> => {
  return safe(async () => {
    const { data } = await supabaseAdmin
      .from("providers")
      .select("fill_rate")
      .eq("status", "active")
      .not("fill_rate", "is", null);

    const rates = (data ?? [])
      .map((r) => toFillPercent(Number(r.fill_rate)))
      .filter((n): n is number => n != null);
    if (!rates.length) return 0;
    return Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
  }, 0);
});

export async function fetchAdminDashboard(): Promise<AdminDashboardData> {
  const [
    metrics,
    recentPayments,
    sessions,
    pipeline,
    billing,
    campaign,
    fillRate,
  ] = await Promise.all([
    fetchAdminMetrics(),
    fetchRecentPayments(),
    fetchSessionMonitor(),
    fetchPipeline(),
    fetchBillingCenter(),
    fetchCampaignMetrics(),
    fetchFillRate(),
  ]);

  return {
    metrics,
    recentPayments,
    sessions,
    pipeline,
    billing,
    campaign,
    fillRate,
  };
}

export async function fetchAdminProviders(): Promise<AdminProviderRow[]> {
  return safe(async () => {
    const { data } = await supabaseAdmin
      .from("providers")
      .select(
        `id, first_name, last_name, provider_type, npi, status, fill_rate,
         license_state, contract_signed, stripe_onboarding_complete, email`
      )
      .order("last_name", { ascending: true });

    return (data ?? []).map((row) => ({
      id: row.id as string,
      first_name: (row.first_name as string) ?? "",
      last_name: (row.last_name as string) ?? "",
      provider_type: (row.provider_type as string) ?? null,
      npi: (row.npi as string) ?? null,
      status: (row.status as string) ?? "pending",
      fill_rate: toFillPercent(row.fill_rate as number | null),
      license_state: (row.license_state as string) ?? null,
      last_session: null,
      next_session: null,
      contract_signed: Boolean(row.contract_signed),
      stripe_ready: Boolean(row.stripe_onboarding_complete),
      email: (row.email as string) ?? null,
    }));
  }, []);
}

export async function fetchComplianceRows(): Promise<ComplianceRow[]> {
  return safe(async () => {
    const { data } = await supabaseAdmin
      .from("providers")
      .select(
        `id, first_name, last_name, license_expiry, malpractice_expiry,
         dea_expiry, caqh_last_attested, oig_excluded, oig_checked_at`
      )
      .order("last_name", { ascending: true });

    return (data ?? []).map((row) => ({
      id: row.id as string,
      name: providerName(row as Record<string, unknown>),
      license_expiry: (row.license_expiry as string) ?? null,
      malpractice_expiry: (row.malpractice_expiry as string) ?? null,
      dea_expiry: (row.dea_expiry as string) ?? null,
      caqh_last_attested: (row.caqh_last_attested as string) ?? null,
      oig_excluded: Boolean(row.oig_excluded),
      oig_checked_at: (row.oig_checked_at as string) ?? null,
    }));
  }, []);
}

export async function fetchAuditLog(): Promise<AuditLogRow[]> {
  return safe(async () => {
    const { data } = await supabaseAdmin
      .from("audit_log")
      .select("id, action, actor_email, entity_type, created_at, changes")
      .order("created_at", { ascending: false })
      .limit(50);

    return (data ?? []).map((row) => ({
      id: row.id as string,
      action: (row.action as string) ?? "other",
      actor_email: (row.actor_email as string) ?? null,
      entity_type: (row.entity_type as string) ?? null,
      created_at: row.created_at as string,
      changes: (row.changes as Record<string, unknown>) ?? null,
    }));
  }, []);
}

export async function fetchBalancePage(): Promise<BalancePageData> {
  const [fillRate, campaign, decisions, scraperQueue] = await Promise.all([
    fetchFillRate(),
    fetchCampaignMetrics(),
    safe<BalanceDecision[]>(async () => {
      const { data } = await supabaseAdmin
        .from("balance_decisions")
        .select("id, decision, reasoning, urgency, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      return (data ?? []).map((row) => ({
        id: row.id as string,
        decision: (row.decision as string) ?? "—",
        reasoning: (row.reasoning as string) ?? "",
        urgency: (row.urgency as string) ?? "low",
        created_at: row.created_at as string,
      }));
    }, []),
    safe<ScraperQueueRow[]>(async () => {
      const { data } = await supabaseAdmin
        .from("outreach_contacts")
        .select(
          "id, first_name, last_name, practice_name, outreach_type, contact_status, fax_sent_at, city, state"
        )
        .eq("contact_status", "not_contacted")
        .order("tier", { ascending: true })
        .limit(25);
      return (data ?? []).map((row) => ({
        id: row.id as string,
        name:
          providerName(row as Record<string, unknown>) ||
          (row.practice_name as string) ||
          "Contact",
        outreach_type: (row.outreach_type as string) ?? null,
        contact_status: (row.contact_status as string) ?? "not_contacted",
        fax_sent_at: (row.fax_sent_at as string) ?? null,
        city: (row.city as string) ?? null,
        state: (row.state as string) ?? null,
      }));
    }, []),
  ]);

  return {
    fillRate,
    allocationReferralPct: campaign.allocationReferralPct,
    allocationRecruitPct: campaign.allocationRecruitPct,
    decisions,
    scraperQueue,
    sentToday: campaign.faxesSentToday,
    dailyLimit: campaign.dailyFaxLimit,
  };
}

export async function fetchCoveragePage(): Promise<CoveragePageData> {
  const [absences, activeProviders] = await Promise.all([
    safe<AbsenceRow[]>(async () => {
      const { data } = await supabaseAdmin
        .from("provider_absences")
        .select(
          `id, absence_type, start_date, end_date, status,
           affected_appointment_ids, coverage_provider_ids,
           provider:providers(first_name, last_name)`
        )
        .order("start_date", { ascending: false })
        .limit(50);

      return (data ?? []).map((row) => {
        const rawP = row.provider as
          | Record<string, unknown>
          | Record<string, unknown>[]
          | null;
        const provider = Array.isArray(rawP) ? rawP[0] : rawP;
        const affected = (row.affected_appointment_ids as unknown[]) ?? [];
        const coverage = (row.coverage_provider_ids as unknown[]) ?? [];
        return {
          id: row.id as string,
          provider_name: providerName(provider),
          absence_type: (row.absence_type as string) ?? "sick",
          start_date: row.start_date as string,
          end_date: row.end_date as string,
          status: (row.status as string) ?? "active",
          affected_count: affected.length,
          coverage_count: coverage.length,
        };
      });
    }, []),
    safe<{ id: string; name: string }[]>(async () => {
      const { data } = await supabaseAdmin
        .from("providers")
        .select("id, first_name, last_name")
        .eq("status", "active")
        .order("last_name", { ascending: true });
      return (data ?? []).map((row) => ({
        id: row.id as string,
        name: providerName(row as Record<string, unknown>),
      }));
    }, []),
  ]);

  const coverageDecisions: CoverageDecisionRow[] = absences
    .filter((a) => a.coverage_count > 0)
    .map((a) => ({
      id: a.id,
      original_provider: a.provider_name,
      coverage_provider: `${a.coverage_count} assigned`,
      patients_notified: a.affected_count,
      status: a.status,
    }));

  return { absences, coverageDecisions, activeProviders };
}

export async function fetchAdminPatients(): Promise<AdminPatientRow[]> {
  return safe(async () => {
    const { data } = await supabaseAdmin
      .from("patients")
      .select(
        `id, first_name, last_name, status, insurance_payer, care_type,
         provider:providers!patients_primary_provider_id_fkey(first_name, last_name)`
      )
      .order("last_name", { ascending: true })
      .limit(200);

    return (data ?? []).map((row) => {
      const rawP = row.provider as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | null;
      const provider = Array.isArray(rawP) ? rawP[0] : rawP;
      return {
        id: row.id as string,
        first_name: (row.first_name as string) ?? "",
        last_name: (row.last_name as string) ?? "",
        status: (row.status as string) ?? "active",
        insurance_payer: (row.insurance_payer as string) ?? null,
        care_type: (row.care_type as string) ?? null,
        primary_provider: provider ? providerName(provider) : null,
        next_appointment: null,
      };
    });
  }, []);
}
