// ============================================================================
// PsychRx — Database TypeScript types
// Mirrors database/schema.sql. All tables share `id`, `created_at`,
// `updated_at` (ISO timestamp strings as returned by Supabase / PostgREST).
// ============================================================================

export type UUID = string;
export type Timestamp = string; // ISO 8601
export type DateString = string; // YYYY-MM-DD

interface BaseRecord {
  id: UUID;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ---------------------------------------------------------------------------
// Enums (string unions matching CHECK constraints)
// ---------------------------------------------------------------------------
export type ProviderStatus = "active" | "inactive" | "pending";

export type ReferralSourceType =
  | "physician"
  | "hospital"
  | "clinic"
  | "online"
  | "self"
  | "insurance"
  | "other";
export type ReferralSourceStatus = "active" | "inactive";

export type Gender = "male" | "female" | "nonbinary" | "other" | "unknown";
export type PatientStatus =
  | "prospective"
  | "active"
  | "inactive"
  | "discharged";

export type AppointmentType =
  | "initial_eval"
  | "follow_up"
  | "therapy"
  | "medication_management"
  | "telehealth"
  | "intake";
export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show"
  | "rescheduled";

export type EncounterStatus = "draft" | "signed" | "amended" | "locked";

export type ClaimStatus =
  | "draft"
  | "submitted"
  | "accepted"
  | "rejected"
  | "denied"
  | "paid"
  | "partially_paid"
  | "appealed";
export type Clearinghouse = "office_ally" | "availity" | "other";

export type PaymentType =
  | "insurance"
  | "patient"
  | "copay"
  | "coinsurance"
  | "adjustment"
  | "refund";
export type PaymentMethod =
  | "card"
  | "cash"
  | "check"
  | "ach"
  | "stripe"
  | "other";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

export type ContractType =
  | "in_network"
  | "out_of_network"
  | "single_case"
  | "group";
export type ContractStatus = "active" | "pending" | "expired" | "terminated";

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "converted"
  | "rejected";

export type WorkerStatus = "started" | "running" | "completed" | "failed";

export type NotificationRecipientType =
  | "provider"
  | "patient"
  | "staff"
  | "owner";
export type NotificationChannel =
  | "sms"
  | "email"
  | "push"
  | "in_app"
  | "voice";
export type NotificationStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "failed"
  | "read";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "view"
  | "login"
  | "logout"
  | "export"
  | "other";

export type InboundChannel = "sms" | "fax" | "voice" | "email";
export type InboundDirection = "inbound" | "outbound";
export type InboundStatus =
  | "pending"
  | "processed"
  | "unmatched"
  | "ignored"
  | "failed"
  | "received";

/** Provider SMS commands handled by the SMS router. */
export type ProviderCommand =
  | "SICK"
  | "CONFIRM"
  | "CANCEL"
  | "AVAIL"
  | "STOP";

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------
export interface Provider extends BaseRecord {
  first_name: string;
  last_name: string;
  credentials: string | null;
  specialty: string | null;
  npi: string | null;
  dea_number: string | null;
  license_number: string | null;
  license_state: string | null;
  email: string | null;
  phone: string | null;
  status: ProviderStatus;
  available: boolean;
  unavailable_reason: string | null;
  unavailable_since: Timestamp | null;
  sms_opt_out: boolean;
  accepts_new_patients: boolean;
  languages: string[];
  insurances: string[];
  care_types: string[];
  specialties: string[];
  fill_rate: number;
  stripe_account_id: string | null;
  stripe_onboarded: boolean;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  license_expires_at: DateString | null;
  malpractice_expires_at: DateString | null;
  dea_expires_at: DateString | null;
  oig_excluded: boolean;
  oig_checked_at: Timestamp | null;
  compliance_suspended: boolean;
}

export interface ReferralSource extends BaseRecord {
  name: string;
  type: ReferralSourceType;
  organization: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: ReferralSourceStatus;
  notes: string | null;
}

export interface Patient extends BaseRecord {
  first_name: string;
  last_name: string;
  date_of_birth: DateString | null;
  gender: Gender | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  insurance_provider: string | null;
  insurance_member_id: string | null;
  insurance_group_number: string | null;
  primary_provider_id: UUID | null;
  referral_source_id: UUID | null;
  status: PatientStatus;
  language: string | null;
  care_type: string | null;
  stripe_customer_id: string | null;
}

export interface Appointment extends BaseRecord {
  patient_id: UUID;
  provider_id: UUID;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  scheduled_start: Timestamp;
  scheduled_end: Timestamp | null;
  location: string | null;
  telehealth_link: string | null;
  notes: string | null;
  reminder_24h_sent_at: Timestamp | null;
  reminder_morning_sent_at: Timestamp | null;
  reminder_2h_sent_at: Timestamp | null;
  reminder_1h_sent_at: Timestamp | null;
  checked_in_at: Timestamp | null;
  fee_amount: number | null;
  paid_to_provider: boolean;
  provider_payment_id: UUID | null;
  no_show_fee_charged: boolean;
}

export interface Encounter extends BaseRecord {
  appointment_id: UUID | null;
  patient_id: UUID;
  provider_id: UUID;
  encounter_date: Timestamp;
  chief_complaint: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  diagnosis_codes: string[];
  cpt_codes: string[];
  status: EncounterStatus;
  signed_by: UUID | null;
  signed_at: Timestamp | null;
}

export interface InsuranceClaim extends BaseRecord {
  encounter_id: UUID | null;
  patient_id: UUID;
  provider_id: UUID | null;
  claim_number: string | null;
  payer_name: string | null;
  payer_id: string | null;
  cpt_codes: string[];
  diagnosis_codes: string[];
  billed_amount: number;
  allowed_amount: number | null;
  paid_amount: number;
  patient_responsibility: number;
  status: ClaimStatus;
  clearinghouse: Clearinghouse | null;
  denial_reason: string | null;
  submitted_at: Timestamp | null;
  adjudicated_at: Timestamp | null;
}

export interface Payment extends BaseRecord {
  patient_id: UUID | null;
  claim_id: UUID | null;
  amount: number;
  payment_type: PaymentType;
  payment_method: PaymentMethod | null;
  stripe_payment_intent_id: string | null;
  status: PaymentStatus;
  payment_date: Timestamp;
  notes: string | null;
}

export type ContractKind = "ica" | "baa" | "patient_consent" | "payer";

export interface Contract extends BaseRecord {
  payer_name: string;
  contract_type: ContractType;
  contract_kind: ContractKind | null;
  provider_id: UUID | null;
  group_npi: string | null;
  reimbursement_rate: number | null;
  effective_date: DateString | null;
  expiration_date: DateString | null;
  status: ContractStatus;
  document_url: string | null;
  docuseal_submission_id: string | null;
  notes: string | null;
}

export interface ScraperLead extends BaseRecord {
  source: string | null;
  business_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  specialty: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lead_score: number | null;
  status: LeadStatus;
  converted_referral_source_id: UUID | null;
  raw_data: Record<string, unknown> | null;
  scraped_at: Timestamp;
}

export interface WorkerLog extends BaseRecord {
  worker_name: string;
  job_type: string | null;
  status: WorkerStatus;
  records_processed: number;
  duration_ms: number | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  started_at: Timestamp;
  finished_at: Timestamp | null;
}

export interface Notification extends BaseRecord {
  recipient_type: NotificationRecipientType;
  recipient_id: UUID | null;
  channel: NotificationChannel;
  subject: string | null;
  body: string | null;
  status: NotificationStatus;
  external_id: string | null;
  metadata: Record<string, unknown> | null;
  sent_at: Timestamp | null;
  read_at: Timestamp | null;
}

export interface InboundContact extends BaseRecord {
  channel: InboundChannel;
  direction: InboundDirection;
  from_number: string | null;
  to_number: string | null;
  body: string | null;
  command: string | null;
  media_url: string | null;
  page_count: number | null;
  external_id: string | null;
  status: InboundStatus;
  matched_provider_id: UUID | null;
  matched_patient_id: UUID | null;
  reply: string | null;
  raw: Record<string, unknown> | null;
  processed_at: Timestamp | null;
}

export type AiChannel = "voice" | "sms" | "web" | "chat";
export type AiStatus =
  | "in_progress"
  | "completed"
  | "transferred"
  | "abandoned"
  | "failed";

export interface AiInteractionTurn {
  role: "assistant" | "user";
  text: string;
  at: Timestamp;
}

export interface AiInteraction extends BaseRecord {
  agent: string;
  channel: AiChannel;
  call_sid: string | null;
  from_number: string | null;
  to_number: string | null;
  patient_id: UUID | null;
  appointment_id: UUID | null;
  intent: string | null;
  status: AiStatus;
  transcript: AiInteractionTurn[];
  collected: Record<string, unknown>;
  summary: string | null;
  model: string | null;
  turns: number;
}

export type SendChannel = "fax" | "email" | "sms";
export type SendCampaign =
  | "referral_outreach"
  | "provider_recruit"
  | "monthly_partner"
  | "other";
export type SendStatus = "queued" | "sent" | "failed" | "skipped";

export interface DailySendLog extends BaseRecord {
  send_date: DateString;
  channel: SendChannel;
  campaign: SendCampaign;
  target_type:
    | "referral_source"
    | "provider"
    | "scraper_lead"
    | "patient"
    | "other"
    | null;
  target_id: UUID | null;
  to_number: string | null;
  status: SendStatus;
  external_id: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
}

export type SlotStatus = "open" | "held" | "booked" | "cancelled";

export interface ProviderSlot extends BaseRecord {
  provider_id: UUID;
  start_time: Timestamp;
  end_time: Timestamp | null;
  status: SlotStatus;
  held_for_patient_id: UUID | null;
  hold_expires_at: Timestamp | null;
  appointment_id: UUID | null;
  source_template_id: UUID | null;
}

export type WaitlistStatus =
  | "waiting"
  | "offered"
  | "booked"
  | "expired"
  | "cancelled";

export interface WaitlistEntry extends BaseRecord {
  patient_id: UUID;
  status: WaitlistStatus;
  care_type: string | null;
  language: string | null;
  insurance: string | null;
  reason: string | null;
  source: string | null;
  priority: number;
  offered_slot_id: UUID | null;
  offered_provider_id: UUID | null;
  offered_at: Timestamp | null;
  offer_expires_at: Timestamp | null;
  matched_at: Timestamp | null;
}

export type MatchAction =
  | "scored"
  | "matched"
  | "offered"
  | "booked"
  | "no_match"
  | "offer_expired"
  | "error";

export interface MatchLogEntry extends BaseRecord {
  patient_id: UUID | null;
  provider_id: UUID | null;
  slot_id: UUID | null;
  score: number | null;
  action: MatchAction;
  details: Record<string, unknown> | null;
}

export type ProviderPaymentStatus = "pending" | "paid" | "failed";

export interface ProviderPayment extends BaseRecord {
  provider_id: UUID;
  period_start: DateString | null;
  period_end: DateString | null;
  session_count: number;
  gross_amount: number;
  provider_amount: number;
  platform_amount: number;
  stripe_transfer_id: string | null;
  status: ProviderPaymentStatus;
  celebration_level: string | null;
  metadata: Record<string, unknown> | null;
}

export type NoShowFeeStatus =
  | "charged"
  | "provider_paid"
  | "uncollectible"
  | "failed"
  | "refunded";

export interface NoShowFee extends BaseRecord {
  appointment_id: UUID | null;
  patient_id: UUID | null;
  provider_id: UUID | null;
  amount: number;
  provider_amount: number;
  platform_amount: number;
  stripe_payment_intent_id: string | null;
  stripe_transfer_id: string | null;
  status: NoShowFeeStatus;
  charged_at: Timestamp | null;
  metadata: Record<string, unknown> | null;
}

export type OnboardingStatus = "in_progress" | "complete" | "rejected";

export interface ProviderOnboardingStatus extends BaseRecord {
  provider_id: UUID;
  current_stage: number;
  stage_data: Record<string, unknown>;
  completed_stages: number[];
  docuseal_submission_id: string | null;
  stripe_onboarding_url: string | null;
  status: OnboardingStatus;
}

export interface AvailabilityTemplate extends BaseRecord {
  provider_id: UUID;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  appointment_type: AppointmentType;
  is_active: boolean;
}

export interface BlockedDate extends BaseRecord {
  provider_id: UUID;
  blocked_date: DateString;
  reason: string | null;
}

export type AbsenceType = "sick" | "vacation" | "emergency";
export type AbsenceStatus = "active" | "resolved" | "cancelled";

export interface ProviderAbsence extends BaseRecord {
  provider_id: UUID;
  absence_type: AbsenceType;
  start_date: DateString;
  end_date: DateString;
  status: AbsenceStatus;
  coverage_provider_ids: UUID[];
  affected_appointment_ids: UUID[];
  notes: string | null;
}

export interface OigExclusion extends BaseRecord {
  npi: string | null;
  name: string | null;
  excluded_at: DateString | null;
  reason: string | null;
}

export interface AuditLogEntry extends BaseRecord {
  actor_id: UUID | null;
  actor_email: string | null;
  action: AuditAction;
  entity_type: string | null;
  entity_id: UUID | null;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
}

// Convenience map of table name -> row type
export interface Database {
  providers: Provider;
  referral_sources: ReferralSource;
  patients: Patient;
  appointments: Appointment;
  encounters: Encounter;
  insurance_claims: InsuranceClaim;
  payments: Payment;
  contracts: Contract;
  scraper_leads: ScraperLead;
  workers_log: WorkerLog;
  notifications: Notification;
  inbound_contacts: InboundContact;
  ai_interactions: AiInteraction;
  daily_send_log: DailySendLog;
  provider_slots: ProviderSlot;
  waitlist: WaitlistEntry;
  match_log: MatchLogEntry;
  provider_payments: ProviderPayment;
  no_show_fees: NoShowFee;
  provider_onboarding_status: ProviderOnboardingStatus;
  availability_templates: AvailabilityTemplate;
  blocked_dates: BlockedDate;
  provider_absences: ProviderAbsence;
  oig_exclusions: OigExclusion;
  audit_log: AuditLogEntry;
}
