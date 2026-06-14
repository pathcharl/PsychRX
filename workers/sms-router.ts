/**
 * PsychRx SMS Router (background worker)
 * --------------------------------------
 * Polls the `sms_commands` table every 10 seconds for unprocessed inbound
 * provider commands and routes them:
 *
 *   SICK    — marks provider unavailable + kicks off the coverage workflow
 *   CONFIRM — confirms the provider's next upcoming appointment
 *   CANCEL  — cancels the next appointment and notifies the patient
 *   AVAIL   — marks the provider available again
 *   STOP    — opts the provider out of SMS
 *
 * Commands are marked processed (with the response sent) after handling.
 * Each run that handles at least one command is recorded in worker_logs.
 */
import cron from "node-cron";
import { supabaseAdmin } from "@/lib/supabase";
import { toE164, formatPhone } from "@/lib/utils";
import {
  parseProviderCommand,
  sendPatientNotification,
  sendProviderAlert,
  sendSms,
} from "@/lib/sms";
import type { ProviderCommand } from "@/lib/types";
import { withWorkerLog } from "@/workers/worker-log";

const WORKER_NAME = "sms-router";
const ACTIVE_STATUSES = ["scheduled", "confirmed", "rescheduled"];
const OWNER_PHONE = process.env.OWNER_PHONE ?? "";

interface SmsCommandRow {
  id: string;
  provider_id: string | null;
  from_phone: string;
  command: string | null;
  raw_message: string | null;
}

interface ProviderRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  specialties: string[] | null;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/** Candidate stored representations of a phone number for tolerant matching. */
function phoneVariants(raw: string): string[] {
  const digits = raw.replace(/\D/g, "");
  const ten =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  const variants = new Set<string>([raw, digits, ten, toE164(raw), formatPhone(raw)]);
  if (ten.length === 10) {
    variants.add(`${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}`);
  }
  return Array.from(variants).filter(Boolean);
}

export async function findProviderByPhone(from: string): Promise<ProviderRow | null> {
  const { data } = await supabaseAdmin
    .from("providers")
    .select("id, first_name, last_name, phone, specialties")
    .in("phone", phoneVariants(from))
    .limit(1);
  return (data?.[0] as ProviderRow | undefined) ?? null;
}

async function getProviderById(id: string): Promise<ProviderRow | null> {
  const { data } = await supabaseAdmin
    .from("providers")
    .select("id, first_name, last_name, phone, specialties")
    .eq("id", id)
    .maybeSingle();
  return (data as ProviderRow | null) ?? null;
}

async function providerNextAppointment(providerId: string) {
  const { data } = await supabaseAdmin
    .from("appointments")
    .select("id, scheduled_at, status, patient_id")
    .eq("provider_id", providerId)
    .gte("scheduled_at", new Date().toISOString())
    .in("status", ACTIVE_STATUSES)
    .order("scheduled_at", { ascending: true })
    .limit(1);
  return data?.[0] ?? null;
}

async function getPatient(patientId: string) {
  const { data } = await supabaseAdmin
    .from("patients")
    .select("id, first_name, last_name, phone")
    .eq("id", patientId)
    .maybeSingle();
  return data ?? null;
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

/**
 * SICK — mark the provider unavailable and open a coverage case
 * (provider_absences row) for the coverage worker to resolve. The owner is
 * alerted immediately.
 */
async function handleSick(provider: ProviderRow): Promise<string> {
  // Sick state lives in provider_absences (the providers table has no
  // available/unavailable_reason columns).

  // Find appointments affected in the next 48 hours.
  const horizon = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  const { data: affected } = await supabaseAdmin
    .from("appointments")
    .select("id")
    .eq("provider_id", provider.id)
    .gte("scheduled_at", new Date().toISOString())
    .lte("scheduled_at", horizon)
    .in("status", ACTIVE_STATUSES);

  const affectedIds = (affected ?? []).map((a: { id: string }) => a.id);
  const today = new Date().toISOString().slice(0, 10);

  // Open an active sick absence (skip if one already exists for today).
  const { data: existing } = await supabaseAdmin
    .from("provider_absences")
    .select("id")
    .eq("provider_id", provider.id)
    .eq("absence_type", "sick")
    .eq("status", "active")
    .limit(1);
  if (!existing?.length) {
    await supabaseAdmin.from("provider_absences").insert({
      provider_id: provider.id,
      absence_type: "sick",
      start_date: today,
      end_date: today,
      status: "active",
      affected_appointment_ids: affectedIds,
      notes: "Reported via SMS SICK command.",
    });
  }

  const name =
    [provider.first_name, provider.last_name].filter(Boolean).join(" ") ||
    "A provider";
  if (OWNER_PHONE) {
    await sendSms(
      OWNER_PHONE,
      `COVERAGE NEEDED: ${name} reported out sick. ${affectedIds.length} ` +
        `appointment(s) in the next 48h need coverage or rescheduling.`,
      { recipientType: "owner", subject: "Coverage needed" }
    );
  }

  return (
    `Got it — you're marked out sick. We're arranging coverage for your ` +
    `${affectedIds.length} upcoming appointment(s). Feel better soon.`
  );
}

async function handleConfirm(provider: ProviderRow): Promise<string> {
  const appt = await providerNextAppointment(provider.id);
  if (!appt) return "You have no upcoming appointments to confirm.";
  await supabaseAdmin
    .from("appointments")
    .update({ status: "confirmed" })
    .eq("id", appt.id);
  return "Thanks — your next session is confirmed.";
}

async function handleCancel(provider: ProviderRow): Promise<string> {
  const appt = await providerNextAppointment(provider.id);
  if (!appt) return "You have no upcoming appointments to cancel.";

  await supabaseAdmin
    .from("appointments")
    .update({
      status: "cancelled",
      cancellation_reason: "Cancelled by provider via SMS",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", appt.id);

  if (appt.patient_id) {
    const patient = await getPatient(appt.patient_id);
    if (patient) {
      await sendPatientNotification(
        patient,
        "We're sorry — your upcoming appointment was cancelled by the office. " +
          "Please call us to reschedule."
      );
    }
  }

  return "Your next session has been cancelled and the patient has been notified.";
}

async function handleAvail(provider: ProviderRow): Promise<string> {
  // Close out any open sick absences (availability is tracked there).
  await supabaseAdmin
    .from("provider_absences")
    .update({ status: "resolved" })
    .eq("provider_id", provider.id)
    .eq("status", "active");
  return "You're marked available again. Thank you!";
}

async function handleStop(_provider: ProviderRow): Promise<string> {
  // No sms_opt_out column on providers; STOP is enforced at the carrier
  // level (Twilio blocks subsequent sends automatically). Stay silent.
  return "";
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

/** Handle one sms_commands row. Returns the reply that was sent (if any). */
async function routeCommand(row: SmsCommandRow): Promise<string> {
  const keyword = (row.command ?? "").trim().toUpperCase();
  const parsed = parseProviderCommand(row.raw_message ?? keyword);
  const command: ProviderCommand | null =
    parsed.command ??
    ((["SICK", "CONFIRM", "CANCEL", "AVAIL", "STOP"].includes(keyword)
      ? keyword
      : null) as ProviderCommand | null);

  const provider = row.provider_id
    ? await getProviderById(row.provider_id)
    : await findProviderByPhone(row.from_phone);

  if (!provider) {
    return "We couldn't match your number to a PsychRx provider. Please contact the office.";
  }

  let reply: string;
  switch (command) {
    case "SICK":
      reply = await handleSick(provider);
      break;
    case "CONFIRM":
      reply = await handleConfirm(provider);
      break;
    case "CANCEL":
      reply = await handleCancel(provider);
      break;
    case "AVAIL":
      reply = await handleAvail(provider);
      break;
    case "STOP":
      reply = await handleStop(provider);
      break;
    default:
      reply =
        "Commands: SICK (out sick), CONFIRM, CANCEL, AVAIL (available), STOP (opt out).";
  }

  if (reply) {
    await sendProviderAlert({ ...provider, phone: provider.phone ?? row.from_phone }, reply);
  }
  return reply;
}

/** Process all unprocessed sms_commands rows. Returns how many were handled. */
export async function runSmsRouterOnce(): Promise<number> {
  const { data: pending, error } = await supabaseAdmin
    .from("sms_commands")
    .select("id, provider_id, from_phone, command, raw_message")
    .eq("processed", false)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error(`[${WORKER_NAME}] poll error:`, error.message);
    return 0;
  }
  if (!pending?.length) return 0;

  let processed = 0;

  await withWorkerLog(WORKER_NAME, async () => {
    for (const row of pending as SmsCommandRow[]) {
      let response = "";
      try {
        response = await routeCommand(row);
      } catch (err) {
        console.error(`[${WORKER_NAME}] error processing command ${row.id}:`, err);
        response = `error: ${err instanceof Error ? err.message : String(err)}`;
      }
      // Mark processed even on failure so a bad row can't wedge the queue.
      await supabaseAdmin
        .from("sms_commands")
        .update({ processed: true, response_sent: response || null })
        .eq("id", row.id);
      processed += 1;
    }
    return { records: processed, message: `processed ${processed} command(s)` };
  });

  return processed;
}

/** Schedule the router to poll every 10 seconds. */
export function startSmsRouter(): void {
  console.log(`[${WORKER_NAME}] scheduled every 10 seconds (polling sms_commands)`);
  cron.schedule("*/10 * * * * *", () => void runSmsRouterOnce());
}

// Run directly: `tsx workers/sms-router.ts`
if (require.main === module) {
  startSmsRouter();
}
