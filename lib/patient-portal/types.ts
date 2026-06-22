export type SessionModality = "video" | "phone";

export interface PortalProvider {
  id: string;
  first_name: string;
  last_name: string;
  credentials: string | null;
  specialties: string[];
  telehealth_link?: string | null;
}

export interface PortalAppointment {
  id: string;
  patient_id: string;
  provider_id: string;
  scheduled_at: string;
  duration_minutes: number;
  session_modality: SessionModality;
  telehealth_link: string | null;
  status: string;
  provider: PortalProvider | null;
}

export interface PortalPatient {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  insurance_payer: string | null;
  insurance_primary_payer_name: string | null;
  insurance_provider: string | null;
  insurance_id: string | null;
  insurance_member_id: string | null;
  insurance_group: string | null;
  insurance_group_number: string | null;
  copay_amount: number | null;
  outstanding_balance: number | null;
  reschedule_count_this_month: number;
  primary_provider_id: string | null;
  secondary_provider_id: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  preferred_pharmacy: string | null;
  session_modality_preference: "video" | "phone" | "either" | null;
  sms_opted_out: boolean;
  telehealth_consent_signed: boolean;
  telehealth_consent_date: string | null;
  care_type: string | null;
}

export interface PortalMessage {
  id: string;
  content: string;
  sender_type: "patient" | "provider";
  created_at: string;
  message_type: string;
  read_at: string | null;
}

export interface PortalSuperbill {
  id: string;
  encounter_id: string | null;
  date_of_service: string;
  file_url: string | null;
  signed_url: string | null;
}

export interface PastAppointment {
  id: string;
  scheduled_at: string;
  session_modality: SessionModality;
  provider: PortalProvider | null;
  amount_billed: number | null;
  insurance_paid: number | null;
  patient_owed: number | null;
  superbill_id: string | null;
}

export interface PortalDashboardData {
  patient: PortalPatient;
  nextAppointment: PortalAppointment | null;
  careTeam: PortalProvider[];
  recentMessages: PortalMessage[];
  questionnaireDue: boolean;
  billing: {
    payer: string;
    copay: number | null;
    outstandingBalance: number | null;
  };
}

export interface PortalAppointmentsData {
  patient: PortalPatient;
  upcoming: PortalAppointment[];
  past: PastAppointment[];
}
