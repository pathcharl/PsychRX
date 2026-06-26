// ============================================================================
// PsychRx — Application constants
// CPT codes, ICD-10 codes, payer IDs, session types, and provider types.
// ============================================================================

// ---------------------------------------------------------------------------
// CPT codes — common psychiatry / behavioral health procedure codes
// ---------------------------------------------------------------------------
export interface CptCode {
  code: string;
  description: string;
  category:
    | "evaluation"
    | "psychotherapy"
    | "psychotherapy_addon"
    | "e_m"
    | "group"
    | "other";
  defaultFee: number; // USD, practice default before contracted rates
}

export const CPT_CODES: CptCode[] = [
  { code: "90791", description: "Psychiatric diagnostic evaluation (no medical)", category: "evaluation", defaultFee: 250 },
  { code: "90792", description: "Psychiatric diagnostic evaluation with medical services", category: "evaluation", defaultFee: 300 },
  { code: "90832", description: "Psychotherapy, 30 minutes", category: "psychotherapy", defaultFee: 100 },
  { code: "90834", description: "Psychotherapy, 45 minutes", category: "psychotherapy", defaultFee: 130 },
  { code: "90837", description: "Psychotherapy, 60 minutes", category: "psychotherapy", defaultFee: 170 },
  { code: "90833", description: "Psychotherapy, 30 min add-on with E/M", category: "psychotherapy_addon", defaultFee: 70 },
  { code: "90836", description: "Psychotherapy, 45 min add-on with E/M", category: "psychotherapy_addon", defaultFee: 90 },
  { code: "90838", description: "Psychotherapy, 60 min add-on with E/M", category: "psychotherapy_addon", defaultFee: 120 },
  { code: "90846", description: "Family psychotherapy without patient", category: "psychotherapy", defaultFee: 130 },
  { code: "90847", description: "Family psychotherapy with patient", category: "psychotherapy", defaultFee: 140 },
  { code: "90853", description: "Group psychotherapy", category: "group", defaultFee: 60 },
  { code: "99212", description: "Office/outpatient visit, established, low", category: "e_m", defaultFee: 75 },
  { code: "99213", description: "Office/outpatient visit, established, moderate", category: "e_m", defaultFee: 110 },
  { code: "99214", description: "Office/outpatient visit, established, moderate-high", category: "e_m", defaultFee: 165 },
  { code: "99215", description: "Office/outpatient visit, established, high", category: "e_m", defaultFee: 230 },
  { code: "99204", description: "Office/outpatient visit, new, moderate", category: "e_m", defaultFee: 200 },
  { code: "99205", description: "Office/outpatient visit, new, high", category: "e_m", defaultFee: 260 },
  { code: "90785", description: "Interactive complexity add-on", category: "other", defaultFee: 25 },
];

export const CPT_CODE_MAP: Record<string, CptCode> = Object.fromEntries(
  CPT_CODES.map((c) => [c.code, c])
);

// ---------------------------------------------------------------------------
// ICD-10 codes — common psychiatric diagnoses
// ---------------------------------------------------------------------------
export interface Icd10Code {
  code: string;
  description: string;
}

export const ICD10_CODES: Icd10Code[] = [
  { code: "F32.9", description: "Major depressive disorder, single episode, unspecified" },
  { code: "F33.1", description: "Major depressive disorder, recurrent, moderate" },
  { code: "F33.2", description: "Major depressive disorder, recurrent, severe without psychotic features" },
  { code: "F41.1", description: "Generalized anxiety disorder" },
  { code: "F41.9", description: "Anxiety disorder, unspecified" },
  { code: "F43.10", description: "Post-traumatic stress disorder, unspecified" },
  { code: "F43.23", description: "Adjustment disorder with mixed anxiety and depressed mood" },
  { code: "F31.9", description: "Bipolar disorder, unspecified" },
  { code: "F31.81", description: "Bipolar II disorder" },
  { code: "F90.0", description: "ADHD, predominantly inattentive type" },
  { code: "F90.1", description: "ADHD, predominantly hyperactive type" },
  { code: "F90.2", description: "ADHD, combined type" },
  { code: "F42.2", description: "Mixed obsessional thoughts and acts (OCD)" },
  { code: "F20.9", description: "Schizophrenia, unspecified" },
  { code: "F50.00", description: "Anorexia nervosa, unspecified" },
  { code: "F10.20", description: "Alcohol use disorder, moderate/severe, uncomplicated" },
  { code: "F11.20", description: "Opioid use disorder, moderate/severe, uncomplicated" },
  { code: "G47.00", description: "Insomnia, unspecified" },
];

export const ICD10_CODE_MAP: Record<string, Icd10Code> = Object.fromEntries(
  ICD10_CODES.map((c) => [c.code, c])
);

// ---------------------------------------------------------------------------
// Payer IDs — electronic payer identifiers used by clearinghouses
// ---------------------------------------------------------------------------
export interface Payer {
  name: string;
  payerId: string;
  clearinghouse: "office_ally" | "availity" | "both";
}

export const PAYERS: Payer[] = [
  { name: "Aetna", payerId: "60054", clearinghouse: "both" },
  { name: "Cigna", payerId: "62308", clearinghouse: "both" },
  { name: "UnitedHealthcare", payerId: "87726", clearinghouse: "both" },
  { name: "Optum Behavioral Health", payerId: "87726", clearinghouse: "availity" },
  { name: "Blue Cross Blue Shield", payerId: "00040", clearinghouse: "both" },
  { name: "Anthem", payerId: "00060", clearinghouse: "availity" },
  { name: "Humana", payerId: "61101", clearinghouse: "both" },
  { name: "Medicare", payerId: "MCARE", clearinghouse: "office_ally" },
  { name: "Medicaid", payerId: "MCAID", clearinghouse: "office_ally" },
  { name: "Tricare", payerId: "99726", clearinghouse: "availity" },
];

export const PAYER_MAP: Record<string, Payer> = Object.fromEntries(
  PAYERS.map((p) => [p.payerId, p])
);

// ---------------------------------------------------------------------------
// Session / appointment types
// ---------------------------------------------------------------------------
export interface SessionType {
  value: string;
  label: string;
  defaultDurationMinutes: number;
  defaultCpt: string;
}

export const SESSION_TYPES: SessionType[] = [
  { value: "initial_eval", label: "Initial Evaluation", defaultDurationMinutes: 60, defaultCpt: "90792" },
  { value: "intake", label: "Intake", defaultDurationMinutes: 60, defaultCpt: "90791" },
  { value: "medication_management", label: "Medication Management", defaultDurationMinutes: 30, defaultCpt: "99214" },
  { value: "follow_up", label: "Follow-up", defaultDurationMinutes: 30, defaultCpt: "99213" },
  { value: "therapy", label: "Psychotherapy", defaultDurationMinutes: 45, defaultCpt: "90834" },
  { value: "telehealth", label: "Telehealth Visit", defaultDurationMinutes: 30, defaultCpt: "99214" },
];

// ---------------------------------------------------------------------------
// Provider types / credentials
// ---------------------------------------------------------------------------
export interface ProviderType {
  value: string;
  label: string;
  canPrescribe: boolean;
}

export const PROVIDER_TYPES: ProviderType[] = [
  { value: "MD", label: "Psychiatrist (MD)", canPrescribe: true },
  { value: "DO", label: "Psychiatrist (DO)", canPrescribe: true },
  { value: "PMHNP", label: "Psychiatric Nurse Practitioner", canPrescribe: true },
  { value: "PA", label: "Physician Assistant", canPrescribe: true },
  { value: "PhD", label: "Psychologist (PhD)", canPrescribe: false },
  { value: "PsyD", label: "Psychologist (PsyD)", canPrescribe: false },
  { value: "LCSW", label: "Licensed Clinical Social Worker", canPrescribe: false },
  { value: "LMFT", label: "Licensed Marriage & Family Therapist", canPrescribe: false },
  { value: "LPC", label: "Licensed Professional Counselor", canPrescribe: false },
];

// ---------------------------------------------------------------------------
// Misc app configuration
// ---------------------------------------------------------------------------
export const APP_NAME = "PsychRx";
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://www.psychrx.com";
export const SUPPORT_EMAIL = process.env.OWNER_EMAIL ?? "support@psychrx.com";
