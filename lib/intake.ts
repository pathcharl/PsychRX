// ============================================================================
// Patient intake processor — normalizes intake from Carol (phone), doctor
// faxes, and the patient portal into a patient record, with a basic insurance
// check and a welcome SMS + email.
// ============================================================================
import { supabaseAdmin } from "@/lib/supabase";
import { toE164 } from "@/lib/utils";
import { sendPatientNotification } from "@/lib/sms";
import { sendEmail } from "@/lib/resend";
import { PAYERS, APP_NAME } from "@/lib/constants";

export type IntakeChannel = "phone" | "fax" | "portal";

export interface IntakeData {
  channel: IntakeChannel;
  first_name: string;
  last_name: string;
  dob?: string | null;
  phone?: string | null;
  email?: string | null;
  insurance?: string | null;
  reason?: string | null;
  language?: string | null;
  care_type?: string | null;
  referral_source?: string | null;
  raw?: Record<string, unknown>;
}

export interface PatientRecord {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  insurance_provider: string | null;
  language: string | null;
  care_type: string | null;
  status: string;
}

export interface InsuranceVerification {
  verified: boolean;
  payerId: string | null;
  network: "in_network" | "unknown";
  message: string;
}

export interface IntakeResult {
  patient: PatientRecord;
  verification: InsuranceVerification;
  intake: IntakeData;
}

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

function splitName(full: string | null | undefined): { first: string; last: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "Unknown", last: "Caller" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function s(value: unknown): string | null {
  if (value == null) return null;
  const str = String(value).trim();
  return str.length ? str : null;
}

// ---------------------------------------------------------------------------
// Insurance verification (basic)
// ---------------------------------------------------------------------------

/**
 * Basic insurance verification: matches the patient's stated insurance against
 * the known payer list. (Full eligibility via Office Ally / Availity is a
 * separate integration.)
 */
export function verifyInsurance(patient: {
  insurance_provider?: string | null;
}): InsuranceVerification {
  const name = (patient.insurance_provider ?? "").trim().toLowerCase();
  if (!name) {
    return {
      verified: false,
      payerId: null,
      network: "unknown",
      message: "No insurance provided; will collect at first visit.",
    };
  }
  const match = PAYERS.find(
    (p) => name.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(name)
  );
  if (match) {
    return {
      verified: true,
      payerId: match.payerId,
      network: "in_network",
      message: `${match.name} recognized (payer ${match.payerId}).`,
    };
  }
  return {
    verified: false,
    payerId: null,
    network: "unknown",
    message: `Insurance "${patient.insurance_provider}" not recognized; manual verification needed.`,
  };
}

// ---------------------------------------------------------------------------
// Patient record
// ---------------------------------------------------------------------------

function resolvePrimaryPayer(insuranceName: string | null | undefined): {
  name: string | null;
  id: string | null;
} {
  const trimmed = insuranceName?.trim();
  if (!trimmed) return { name: null, id: null };

  const normalized = trimmed.toLowerCase();
  const match = PAYERS.find(
    (p) =>
      normalized.includes(p.name.toLowerCase()) ||
      p.name.toLowerCase().includes(normalized)
  );

  return {
    name: trimmed,
    id: match?.payerId ?? null,
  };
}

/** Create (or update an existing, de-duplicated) patient record. */
export async function createPatientRecord(data: IntakeData): Promise<PatientRecord> {
  const phone = toE164(data.phone);
  const email = data.email?.trim().toLowerCase() || null;
  const payer = resolvePrimaryPayer(data.insurance);

  // De-dupe by phone, then email.
  let existingId: string | null = null;
  if (phone) {
    const { data: byPhone, error: phoneErr } = await supabaseAdmin
      .from("patients")
      .select("id")
      .eq("phone", phone)
      .limit(1);
    if (phoneErr) throw new Error(`Patient lookup by phone failed: ${phoneErr.message}`);
    existingId = (byPhone?.[0] as { id: string } | undefined)?.id ?? null;
  }
  if (!existingId && email) {
    const { data: byEmail, error: emailErr } = await supabaseAdmin
      .from("patients")
      .select("id")
      .eq("email", email)
      .limit(1);
    if (emailErr) throw new Error(`Patient lookup by email failed: ${emailErr.message}`);
    existingId = (byEmail?.[0] as { id: string } | undefined)?.id ?? null;
  }

  const fields: Record<string, unknown> = {
    first_name: data.first_name || "Unknown",
    last_name: data.last_name || "Caller",
    dob: data.dob || null,
    phone: phone || null,
    email,
    insurance_primary_payer_name: payer.name,
    insurance_primary_payer_id: payer.id,
    insurance_primary_member_id:
      s(data.raw?.insurance_primary_member_id) ??
      s(data.raw?.insurance_member_id) ??
      s(data.raw?.member_id),
    insurance_primary_group_number:
      s(data.raw?.insurance_primary_group_number) ??
      s(data.raw?.insurance_group_number) ??
      s(data.raw?.group_number),
    preferred_language: data.language || "English",
    preferred_provider_type: data.care_type ?? null,
    referral_source: data.referral_source ?? null,
    intake_completed: true,
    intake_completed_at: new Date().toISOString(),
  };

  const selectCols =
    "id, first_name, last_name, phone, email, dob, insurance_primary_payer_name, insurance_primary_payer_id, preferred_language, preferred_provider_type, status";

  const writePatient = async () => {
    if (existingId) {
      const { data: updated, error } = await supabaseAdmin
        .from("patients")
        .update(fields)
        .eq("id", existingId)
        .select(selectCols)
        .maybeSingle();
      if (error) throw error;
      if (!updated) throw new Error("Patient update returned no row");
      return updated;
    }

    const { data: created, error } = await supabaseAdmin
      .from("patients")
      .insert({ ...fields, status: "prospective" })
      .select(selectCols)
      .maybeSingle();
    if (error) throw error;
    if (!created) throw new Error("Patient insert returned no row");
    return created;
  };

  let row: Record<string, unknown>;
  try {
    row = await writePatient();
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
    throw new Error(`Failed to create patient: ${message}`);
  }

  return {
    id: String(row.id),
    first_name: String(row.first_name ?? data.first_name),
    last_name: String(row.last_name ?? data.last_name),
    phone: (row.phone as string | null) ?? phone,
    email: (row.email as string | null) ?? email,
    insurance_provider:
      (row.insurance_primary_payer_name as string | null) ?? payer.name,
    language: (row.preferred_language as string | null) ?? data.language ?? null,
    care_type:
      (row.preferred_provider_type as string | null) ?? data.care_type ?? null,
    status: String(row.status ?? "prospective"),
  };
}

/** Add a patient to the waitlist. */
export async function addToWaitlist(
  patient: PatientRecord,
  intake: Pick<IntakeData, "care_type" | "language" | "insurance" | "reason" | "channel">,
  priority = 0
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("waitlist")
    .insert({
      patient_id: patient.id,
      status: "waiting",
      care_type: intake.care_type ?? patient.care_type ?? null,
      language: intake.language ?? patient.language ?? null,
      insurance: intake.insurance ?? patient.insurance_provider ?? null,
      reason: intake.reason ?? null,
      source: intake.channel,
      priority,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[intake] waitlist insert failed:", error);
    throw new Error(
      `Failed to add to waitlist (${error.code ?? "unknown"}): ${error.message}. ` +
        "Run database/matching.sql to create the waitlist table."
    );
  }

  return (data as { id: string } | null)?.id ?? null;
}

// ---------------------------------------------------------------------------
// Channel processors
// ---------------------------------------------------------------------------

async function process(data: IntakeData): Promise<IntakeResult> {
  const patient = await createPatientRecord(data);
  const verification = verifyInsurance(patient);
  return { patient, verification, intake: data };
}

/** Process intake collected by Carol on a phone call. */
export async function processPhoneIntake(
  callerData: Record<string, unknown> & { from?: string | null }
): Promise<IntakeResult> {
  const first = s(callerData.first_name);
  const last = s(callerData.last_name);
  const name = !first && !last ? splitName(s(callerData.name)) : null;
  return process({
    channel: "phone",
    first_name: first ?? name?.first ?? "Unknown",
    last_name: last ?? name?.last ?? "Caller",
    dob: s(callerData.dob),
    phone: s(callerData.phone) ?? s(callerData.from),
    email: s(callerData.email),
    insurance: s(callerData.insurance),
    reason: s(callerData.reason),
    language: s(callerData.language),
    care_type: s(callerData.care_type),
    raw: callerData,
  });
}

/** Process a referral fax (fields extracted by lib/fax parseFaxContent). */
export async function processFaxReferral(
  faxData: Record<string, unknown>
): Promise<IntakeResult> {
  const { first, last } = splitName(s(faxData.patient_name));
  return process({
    channel: "fax",
    first_name: s(faxData.first_name) ?? first,
    last_name: s(faxData.last_name) ?? last,
    dob: s(faxData.patient_dob) ?? s(faxData.dob),
    phone: s(faxData.patient_phone) ?? s(faxData.phone),
    insurance: s(faxData.insurance),
    reason: s(faxData.reason_for_referral) ?? s(faxData.reason),
    referral_source: s(faxData.referring_provider) ?? s(faxData.referring_practice),
    raw: faxData,
  });
}

/** Process intake submitted through the patient portal. */
export async function processPortalIntake(
  formData: Record<string, unknown>
): Promise<IntakeResult> {
  const first = s(formData.first_name);
  const last = s(formData.last_name);
  const name = !first && !last ? splitName(s(formData.name)) : null;
  return process({
    channel: "portal",
    first_name: first ?? name?.first ?? "Unknown",
    last_name: last ?? name?.last ?? "Patient",
    dob: s(formData.dob) ?? s(formData.date_of_birth),
    phone: s(formData.phone),
    email: s(formData.email),
    insurance: s(formData.insurance) ?? s(formData.insurance_provider),
    reason: s(formData.reason),
    language: s(formData.language),
    care_type: s(formData.care_type),
    raw: formData,
  });
}

// ---------------------------------------------------------------------------
// Welcome sequence
// ---------------------------------------------------------------------------

/** Send a welcome SMS + email to a new patient (best-effort). */
export async function sendWelcomeSequence(patient: PatientRecord): Promise<void> {
  const firstName = patient.first_name || "there";
  const smsBody =
    `Hi ${firstName}, welcome to ${APP_NAME}! We've received your information and ` +
    `are matching you with the right provider. We'll text you shortly with next steps.`;

  try {
    if (patient.phone) {
      await sendPatientNotification(patient, smsBody);
    }
  } catch (err) {
    console.error("[intake] welcome SMS failed:", err);
  }

  try {
    if (patient.email) {
      console.log("[intake] triggering patient welcome email for:", patient.email);

      const emailResult = await sendEmail({
        to: patient.email,
        subject: `Welcome to ${APP_NAME}`,
        text: `Hi ${firstName},\n\n${smsBody}\n\n— The ${APP_NAME} Team`,
        html:
          `<p>Hi ${firstName},</p><p>Welcome to ${APP_NAME}! We've received your ` +
          `information and are matching you with the right provider. We'll be in ` +
          `touch shortly with next steps.</p><p>— The ${APP_NAME} Team</p>`,
      });

      if (emailResult.error) {
        console.error(
          "[intake] patient welcome email failed for:",
          patient.email,
          emailResult.error
        );
      } else {
        console.log(
          "[intake] patient welcome email succeeded for:",
          patient.email,
          emailResult
        );
      }
    }
  } catch (err) {
    console.error("[intake] patient welcome email failed for:", patient.email, err);
  }
}
