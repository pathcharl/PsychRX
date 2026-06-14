import { sendSms as twilioSendSms } from "@/lib/twilio";
import { supabaseAdmin } from "@/lib/supabase";
import { toE164 } from "@/lib/utils";
import type { NotificationRecipientType, ProviderCommand } from "@/lib/types";

/** Timezone used to format appointment times in patient-facing messages. */
const OFFICE_TIMEZONE = process.env.OFFICE_TIMEZONE ?? "America/New_York";

/** Provider keyword commands recognized by the SMS router. */
export const PROVIDER_COMMANDS: ProviderCommand[] = [
  "SICK",
  "CONFIRM",
  "CANCEL",
  "AVAIL",
  "STOP",
];

export interface SmsRecipient {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
}

export interface SendSmsOptions {
  recipientType?: NotificationRecipientType;
  recipientId?: string | null;
  subject?: string | null;
  /** Set false to skip writing a notifications row. */
  log?: boolean;
}

export interface SmsResult {
  to: string;
  sid: string | null;
  skipped: boolean;
  reason?: string;
}

/**
 * Send an SMS via Twilio. The destination is normalized to E.164.
 * Returns `{ skipped: true }` when the number is missing/invalid (no throw),
 * so callers iterating over many recipients don't abort on bad data.
 */
export async function sendSms(
  to: string | null | undefined,
  message: string,
  options: SendSmsOptions = {}
): Promise<SmsResult> {
  const e164 = toE164(to);
  if (!e164) {
    return { to: "", sid: null, skipped: true, reason: "invalid_phone" };
  }

  let sid: string | null = null;
  try {
    const result = await twilioSendSms(e164, message);
    sid = (result as { sid?: string } | null)?.sid ?? null;
  } catch (err) {
    console.error("[sms] send failed:", { to: e164, err });
    return { to: e164, sid: null, skipped: true, reason: "send_failed" };
  }

  if (options.log !== false) {
    try {
      await supabaseAdmin.from("notifications").insert({
        recipient_type: options.recipientType ?? "staff",
        recipient_id: options.recipientId ?? null,
        channel: "sms",
        subject: options.subject ?? null,
        body: message,
        status: "sent",
        external_id: sid,
        sent_at: new Date().toISOString(),
        metadata: { to: e164 },
      });
    } catch (err) {
      console.error("[sms] notification log failed:", { to: e164, err });
    }
  }

  return { to: e164, sid, skipped: false };
}

/** Format an appointment time in the office timezone, e.g. "Mon, Mar 4 at 2:30 PM". */
function formatApptTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const datePart = new Intl.DateTimeFormat("en-US", {
    timeZone: OFFICE_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", {
    timeZone: OFFICE_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${datePart} at ${timePart}`;
}

/** Build a display name like "Dr. Smith" or "Jane Smith, PMHNP". */
function providerName(p?: ReminderAppointment["provider"]): string {
  if (!p) return "your provider";
  const last = p.last_name?.trim();
  const first = p.first_name?.trim();
  const creds = p.credentials?.trim();
  if (creds && /^(MD|DO)$/i.test(creds) && last) return `Dr. ${last}`;
  const full = [first, last].filter(Boolean).join(" ").trim();
  if (!full) return "your provider";
  return creds ? `${full}, ${creds}` : full;
}

export interface ReminderAppointment {
  id: string;
  /** appointments.scheduled_at */
  scheduled_at: string;
  /** appointments.telehealth_url */
  telehealth_url?: string | null;
  patient?: SmsRecipient | null;
  provider?: {
    first_name?: string | null;
    last_name?: string | null;
    credentials?: string | null;
  } | null;
}

/**
 * Send an appointment reminder SMS to the patient.
 * Returns `{ skipped: true }` if the patient has no usable phone number.
 */
export async function sendAppointmentReminder(
  appointment: ReminderAppointment,
  options: { label?: string } = {}
): Promise<SmsResult> {
  const phone = appointment.patient?.phone;
  const firstName = appointment.patient?.first_name?.trim() || "there";
  const when = formatApptTime(appointment.scheduled_at);
  const provider = providerName(appointment.provider);

  const where = appointment.telehealth_url
    ? "This is a telehealth visit — you'll receive your video link separately."
    : "";

  const prefix = options.label ? `${options.label}: ` : "";
  const message =
    `${prefix}Hi ${firstName}, this is a reminder of your appointment with ` +
    `${provider} on ${when}. ${where} Reply CONFIRM to confirm or CANCEL to cancel.`.replace(
      /\s+/g,
      " "
    ).trim();

  return sendSms(phone, message, {
    recipientType: "patient",
    recipientId: appointment.patient?.id ?? null,
    subject: "Appointment reminder",
  });
}

/** Send an alert SMS to a provider. */
export async function sendProviderAlert(
  provider: SmsRecipient,
  message: string
): Promise<SmsResult> {
  return sendSms(provider.phone, message, {
    recipientType: "provider",
    recipientId: provider.id ?? null,
    subject: "Provider alert",
  });
}

/** Send a notification SMS to a patient. */
export async function sendPatientNotification(
  patient: SmsRecipient,
  message: string
): Promise<SmsResult> {
  return sendSms(patient.phone, message, {
    recipientType: "patient",
    recipientId: patient.id ?? null,
    subject: "Notification",
  });
}

export interface ParsedProviderCommand {
  command: ProviderCommand | null;
  args: string[];
  raw: string;
}

/**
 * Parse a provider SMS into a recognized command + arguments.
 * Recognizes: SICK, CONFIRM, CANCEL, AVAIL, STOP (case-insensitive).
 */
export function parseProviderCommand(
  body: string | null | undefined
): ParsedProviderCommand {
  const raw = (body ?? "").trim();
  const tokens = raw.split(/\s+/).filter(Boolean);
  const keyword = (tokens[0] ?? "").toUpperCase();
  const command = (PROVIDER_COMMANDS as string[]).includes(keyword)
    ? (keyword as ProviderCommand)
    : null;
  return { command, args: tokens.slice(1), raw };
}
