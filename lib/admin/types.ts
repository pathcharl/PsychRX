export interface AdminMetrics {
  activeProviders: number;
  providersByType: Record<string, number>;
  activePatients: number;
  sessionsThisWeek: number;
  revenueThisWeek: number;
}

export interface PaymentFeedItem {
  id: string;
  provider_id: string | null;
  provider_name: string;
  provider_amount: number;
  session_count: number | null;
  created_at: string;
  transferred_at: string | null;
}

export type SessionMonitorStatus =
  | "upcoming"
  | "in_progress"
  | "completed"
  | "no_show";

export interface SessionMonitorRow {
  id: string;
  start_time: string;
  patient_name: string;
  provider_name: string;
  status: SessionMonitorStatus;
  modality: string;
}

export type PipelineStage =
  | "applied"
  | "documents"
  | "contract"
  | "stripe"
  | "active";

export interface PipelineProvider {
  id: string;
  name: string;
  provider_type: string | null;
  stage: PipelineStage;
  days_in_stage: number;
  stuck: boolean;
}

export interface BillingCenter {
  claimsPending: number;
  claimsPaidThisMonth: number;
  denialRate: number;
  avgDaysToPayment: number;
}

export interface CampaignMetrics {
  faxesSentToday: number;
  dailyFaxLimit: number;
  referralSourcesContacted: number;
  providerRecruitsContacted: number;
  allocationReferralPct: number;
  allocationRecruitPct: number;
}

export interface AdminDashboardData {
  metrics: AdminMetrics;
  recentPayments: PaymentFeedItem[];
  sessions: SessionMonitorRow[];
  pipeline: PipelineProvider[];
  billing: BillingCenter;
  campaign: CampaignMetrics;
  fillRate: number;
}

export interface AdminProviderRow {
  id: string;
  first_name: string;
  last_name: string;
  provider_type: string | null;
  npi: string | null;
  status: string;
  fill_rate: number | null;
  license_state: string | null;
  last_session: string | null;
  next_session: string | null;
  contract_signed: boolean;
  stripe_ready: boolean;
  email: string | null;
}

export interface ComplianceRow {
  id: string;
  name: string;
  license_expiry: string | null;
  malpractice_expiry: string | null;
  dea_expiry: string | null;
  caqh_last_attested: string | null;
  oig_excluded: boolean;
  oig_checked_at: string | null;
}

export interface AuditLogRow {
  id: string;
  action: string;
  actor_email: string | null;
  entity_type: string | null;
  created_at: string;
  changes: Record<string, unknown> | null;
}

export interface BalanceDecision {
  id: string;
  decision: string;
  reasoning: string;
  urgency: string;
  created_at: string;
}

export interface ScraperQueueRow {
  id: string;
  name: string;
  outreach_type: string | null;
  contact_status: string;
  fax_sent_at: string | null;
  city: string | null;
  state: string | null;
}

export interface BalancePageData {
  fillRate: number;
  allocationReferralPct: number;
  allocationRecruitPct: number;
  decisions: BalanceDecision[];
  scraperQueue: ScraperQueueRow[];
  sentToday: number;
  dailyLimit: number;
}

export interface AbsenceRow {
  id: string;
  provider_name: string;
  absence_type: string;
  start_date: string;
  end_date: string;
  status: string;
  affected_count: number;
  coverage_count: number;
}

export interface CoverageDecisionRow {
  id: string;
  original_provider: string;
  coverage_provider: string;
  patients_notified: number;
  status: string;
}

export interface CoveragePageData {
  absences: AbsenceRow[];
  coverageDecisions: CoverageDecisionRow[];
  activeProviders: { id: string; name: string }[];
}

export interface AdminPatientRow {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  insurance_payer: string | null;
  care_type: string | null;
  primary_provider: string | null;
  next_appointment: string | null;
}
