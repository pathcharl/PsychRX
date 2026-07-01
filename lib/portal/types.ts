export interface PortalProvider {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  credentials: string | null;
  email: string | null;
  phone: string | null;
  telehealth_link: string | null;
  direct_phone: string | null;
  direct_fax: string | null;
  status: string;
  fill_rate: number | null;
  revenue_share: number | null;
  stripe_connect_id: string | null;
  stripe_account_id: string | null;
  stripe_connect_ready: boolean;
  accepts_new_patients: boolean;
  caqh_last_attested: string | null;
  malpractice_carrier: string | null;
  malpractice_expiry: string | null;
  pt_profile_url: string | null;
  license_state: string | null;
  provider_type: string | null;
  all_time_earnings: number | null;
  all_time_sessions: number | null;
}

export interface PortalPatientSummary {
  id: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  phone: string | null;
  insurance_payer: string | null;
  insurance_verified: boolean;
  no_show_risk: string | null;
  care_type: string | null;
  next_appointment: string | null;
  session_count: number;
  primary_diagnosis: string | null;
  treatment_start: string | null;
  last_phq9_score: number | null;
}

export interface TodaySession {
  id: string;
  start_time: string;
  appointment_type: string | null;
  session_modality: string;
  status: string;
  telehealth_link: string | null;
  encounter_submitted: boolean;
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    insurance_payer: string | null;
  };
}

export interface CelebrationPayment {
  id: string;
  provider_amount: number;
  session_count: number | null;
  unique_patients: number | null;
  celebration_level: string | null;
}

export interface ExternalAlert {
  id: string;
  channel: string;
  intent: string | null;
  content: string | null;
  from_number: string | null;
  created_at: string;
  patient_id: string | null;
}

export interface DocumentAlert {
  id: string;
  document_type: string;
  expiry_date: string | null;
  days_until_expiry: number | null;
  status: "green" | "yellow" | "red" | "grey";
}

export interface ProviderPaymentRow {
  id: string;
  payment_period_start: string;
  payment_period_end: string;
  gross_collected: number;
  psychrx_fee: number;
  provider_amount: number;
  session_count: number;
  transfer_status: string;
  transferred_at: string | null;
}

export interface ProviderMilestone {
  id: string;
  milestone_id: string;
  milestone_title: string | null;
  awarded_at: string;
}

export interface PortalMessage {
  id: string;
  content: string;
  sender_type: string;
  created_at: string;
  read_at: string | null;
}

export interface SessionHistoryRow {
  id: string;
  date_of_service: string;
  cpt_code: string;
  charge_amount: number | null;
  claim_status: string;
}

export interface Phq9Point {
  date: string;
  score: number;
}

export interface SidebarBadges {
  unreadMessages: number;
  notesDue: number;
}

export interface NextPaymentInfo {
  amount: number;
  date: string;
}

export interface DashboardData {
  celebration: CelebrationPayment | null;
  todaySessions: TodaySession[];
  fillRate: number;
  notesDue: number;
  nextPaymentEstimate: number;
  documentAlerts: DocumentAlert[];
  externalAlerts: ExternalAlert[];
  badges: SidebarBadges;
  nextPayment: NextPaymentInfo;
}

export interface AvailabilityDay {
  day_of_week: number;
  enabled: boolean;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  buffer_minutes: number;
  max_sessions: number;
  template_id: string | null;
}

export interface ProviderDocument {
  id: string;
  document_type: string;
  file_url: string | null;
  expiry_date: string | null;
  verified: boolean;
}

export interface CollaborativeAgreement {
  id: string;
  md_name: string | null;
  expiry_date: string | null;
  status: string;
}

export interface ScribeAppointment {
  id: string;
  patient_id: string;
  patient_name: string;
  appointment_type: string | null;
  session_modality: string;
  start_time: string;
}

export interface AuditResult {
  status: "pass" | "fail" | "warn";
  label: string;
  detail?: string;
}
