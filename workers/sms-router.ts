/**
 * PsychRx SMS Router (background worker)
 * --------------------------------------
 * Handles inbound provider SMS commands and logs every message to the
 * `inbound_contacts` table.
 *
 *   SICK    — mark provider unavailable + trigger coverage workflow
 *   CONFIRM — confirm provider for their next upcoming session
 *   CANCEL  — cancel the next session and notify the patient
 *   AVAIL   — mark provider available again
 *   STOP    — opt the provider out of SMS
 *
 * Entry points:
 *   processProviderSms(input)  — log + handle a single inbound SMS (call this
 *                                from the Twilio webhook)
 *   runSmsRouterOnce()         — process any pending inbound SMS rows
 *   startSmsRouter()           — poll loop (run as a standalone worker)
 *
 * All DB access uses supabaseAdmin; all phone numbers are stored in E.164.
 */
import { supabaseAdmin } from "@/lib/supabase";
import { toE164, formatPhone } from "@/lib/utils";
import {
  parseProviderCommand,
  sendProviderAlert,
  sendPatientNotification,
  sendSms,
} from "@/lib/sms";
import type { ProviderCommand } from "@/lib/types";

const ACTIVE_STATUSES = ["scheduled", "confirmed", "rescheduled"];
const POLL_INTERVAL_MS = Number(process.env.SMS_ROUTER_INTERVAL_MS ?? 10_000);

const OWNER_PHONE = process.env.OWNER_PHONE ?? "";
const BILLING_COORDINATOR_PHONE = process.env.BILLING_COORDINATOR_PHONE ?? "";

export interface InboundSmsInput {
  from: string;
  body: string;
  externalId?: string | null;
  to?: string | null;
}

export interface RouterResult {
  reply: string | null;
  status: "processed" | "unmatched" | "ignored" | "failed";
  command: ProviderCommand | null;
  providerId: string | null;
}

interface ProviderRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  sms_opt_out?: boolean | null;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/** Candidate stored representations of a phone number for tolerant matching. */
function phoneVariants(raw: string): string[] {
  const digits = raw.replace(/\D/g, "");
  const ten =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  const variants = new Set<string>([
    raw,
    digits,
    ten,
    toE164(raw),
    formatPhone(raw),
  ]);
  if (ten.length === 10) {
    variants.add(`${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}`);
  }
  return Array.from(variants).filter(Boolean);
}

export async function findProviderByPhone(
  from: string
): Promise<ProviderRow | null> {
  const { data } = await supabaseAdmin
    .from("providers")
    .select("id, first_name, last_name, phone, sms_opt_out")
    .in("phone", phoneVariants(from))
    .limit(1);
  return (data?.[0] as ProviderRow | undefined) ?? null;
}

async function providerNextAppointment(providerId: string) {
  const { data } = await supabaseAdmin
    .from("appointments")
    .select("id, scheduled_start, status, patient_id")
    .eq("provider_id", providerId)
    .gte("scheduled_start", new Date().toISOString())
    .in("status", ACTIVE_STATUSES)
    .order("scheduled_start", { ascending: true })
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
// inbound_contacts logging
// ---------------------------------------------------------------------------

async function logInbound(input: InboundSmsInput): Promise<string | null> {
  const fromE164 = toE164(input.from) || input.from;
  const parsed = parseProviderCommand(input.body);
  const { data, error } = await supabaseAdmin
    .from("inbound_contacts")
    .insert({
      channel: "sms",
      direction: "inbound",
      from_number: fromE164,
      to_number: input.to ? toE164(input.to) || input.to : null,
      body: input.body,
      command: parsed.command,
      external_id: input.externalId ?? null,
      status: "pending",
      raw: { from: input.from, body: input.body },
    })
    .select("id")
    .maybeSingle();
  if (error) return null;
  return (data as { id: string } | null)?.id ?? null;
}

async function finalizeInbound(
  id: string | null,
  result: RouterResult
): Promise<void> {
  if (!id) return;
  await supabaseAdmin
    .from("inbound_contacts")
    .update({
      status: result.status,
      command: result.command,
      reply: result.reply,
      matched_provider_id: result.providerId,
      processed_at: new Date().toISOString(),
    })
    .eq("id", id);
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async function handleSick(provider: ProviderRow): Promise<string> {
  await supabaseAdmin
    .from("providers")
    .update({
      available: false,
      unavailable_reason: "sick",
      unavailable_since: new Date().toISOString(),
    })
    .eq("id", provider.id);

  // Coverage workflow: find affected appointments in the next 48 hours.
  const horizon = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  const { data: affected } = await supabaseAdmin
    .from("appointments")
    .select("id, scheduled_start, status, patient_id")
    .eq("provider_id", provider.id)
    .gte("scheduled_start", new Date().toISOString())
    .lte("scheduled_start", horizon)
    .in("status", ACTIVE_STATUSES)
    .order("scheduled_start", { ascending: true });

  const count = affected?.length ?? 0;
  const name =
    [provider.first_name, provider.last_name].filter(Boolean).join(" ") ||
    "A provider";

  const alert =
    `COVERAGE NEEDED: ${name} reported out sick. ` +
    `${count} appointment(s) in the next 48h need coverage or rescheduling.`;

  // Alert the owner + billing coordinator and record notifications.
  for (const phone of [OWNER_PHONE, BILLING_COORDINATOR_PHONE]) {
    if (phone) {
      await sendSms(phone, alert, {
        recipientType: "owner",
        subject: "Coverage needed",
      });
    }
  }
  await supabaseAdmin.from("notifications").insert({
    recipient_type: "owner",
    channel: "in_app",
    subject: "Coverage needed",
    body: alert,
    status: "pending",
    metadata: {
      provider_id: provider.id,
      affected_appointment_ids: (affected ?? []).map(
        (a: { id: string }) => a.id
      ),
    },
  });

  return (
    `Got it — you're marked out sick. We've alerted the office to arrange ` +
    `coverage for your ${count} upcoming appointment(s). Feel better soon.`
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
      notes: "Cancelled by provider via SMS.",
    })
    .eq("id", appt.id);

  // Notify the affected patient.
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
  await supabaseAdmin
    .from("providers")
    .update({
      available: true,
      unavailable_reason: null,
      unavailable_since: null,
    })
    .eq("id", provider.id);
  return "You're marked available again. Thank you!";
}

async function handleStop(provider: ProviderRow): Promise<void> {
  await supabaseAdmin
    .from("providers")
    .update({ sms_opt_out: true })
    .eq("id", provider.id);
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

/** Core dispatcher: resolves the provider, runs the command, returns the reply. */
async function route(input: InboundSmsInput): Promise<RouterResult> {
  const parsed = parseProviderCommand(input.body);
  const provider = await findProviderByPhone(input.from);

  if (!provider) {
    return {
      reply: null,
      status: "unmatched",
      command: parsed.command,
      providerId: null,
    };
  }

  // STOP is also handled at the carrier level; record the opt-out and stay silent.
  if (parsed.command === "STOP") {
    await handleStop(provider);
    return { reply: null, status: "processed", command: "STOP", providerId: provider.id };
  }

  let reply: string;
  switch (parsed.command) {
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
    default:
      return {
        reply:
          "Commands: SICK (out sick), CONFIRM, CANCEL, AVAIL (available), STOP (opt out).",
        status: "ignored",
        command: null,
        providerId: provider.id,
      };
  }

  // Send the reply back to the provider unless they've opted out.
  if (reply && !provider.sms_opt_out) {
    await sendProviderAlert(provider, reply);
  }

  return { reply, status: "processed", command: parsed.command, providerId: provider.id };
}

/**
 * Log + handle a single inbound SMS. Call this from the Twilio webhook.
 * Returns the reply text (or null) and resulting status.
 */
export async function processProviderSms(
  input: InboundSmsInput
): Promise<RouterResult> {
  const id = await logInbound(input);
  let result: RouterResult;
  try {
    result = await route(input);
  } catch (err) {
    result = {
      reply: null,
      status: "failed",
      command: parseProviderCommand(input.body).command,
      providerId: null,
    };
    console.error("[sms-router] failed to process inbound SMS:", err);
  }
  await finalizeInbound(id, result);
  return result;
}

/**
 * Process any inbound SMS rows that were logged but not yet handled
 * (status = 'pending'). Useful when messages are queued by the webhook
 * and processed asynchronously by this worker.
 */
export async function runSmsRouterOnce(): Promise<number> {
  const { data: pending, error } = await supabaseAdmin
    .from("inbound_contacts")
    .select("id, from_number, body, external_id")
    .eq("channel", "sms")
    .eq("direction", "inbound")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error || !pending?.length) return 0;

  let processed = 0;
  for (const row of pending as Array<{
    id: string;
    from_number: string | null;
    body: string | null;
  }>) {
    try {
      const result = await route({
        from: row.from_number ?? "",
        body: row.body ?? "",
      });
      await finalizeInbound(row.id, result);
      processed += 1;
    } catch (err) {
      console.error("[sms-router] error processing row", row.id, err);
      await finalizeInbound(row.id, {
        reply: null,
        status: "failed",
        command: null,
        providerId: null,
      });
    }
  }
  return processed;
}

/** Run the router as a long-lived polling worker. */
export function startSmsRouter(): void {
  console.log(
    `[sms-router] started; polling every ${POLL_INTERVAL_MS}ms for pending SMS`
  );
  const tick = async () => {
    try {
      const n = await runSmsRouterOnce();
      if (n > 0) console.log(`[sms-router] processed ${n} message(s)`);
    } catch (err) {
      console.error("[sms-router] poll error:", err);
    }
  };
  void tick();
  setInterval(() => void tick(), POLL_INTERVAL_MS);
}

// Run directly: `tsx workers/sms-router.ts`
if (require.main === module) {
  startSmsRouter();
}
