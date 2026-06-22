import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody, dbError } from "@/lib/api";
import { sendSms } from "@/lib/sms";

export const runtime = "nodejs";

/** Severity at/above which an urgent message escalates to an SMS alert. */
const URGENT_SEVERITY_THRESHOLD = 8;

const sendSchema = z.object({
  patient_id: z.string().uuid(),
  provider_id: z.string().uuid(),
  sender_type: z.enum(["patient", "provider"]),
  content: z.string().min(1).max(5000),
  conversation_id: z.string().uuid().optional(),
  urgent_concern: z.boolean().optional(),
  severity: z.number().int().min(0).max(10).optional(),
});

/** Find an existing patient/provider conversation, scanning participants. */
async function findPairConversation(
  patientId: string,
  providerId: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("conversations")
    .select("id, participants")
    .eq("conversation_type", "provider_patient")
    .order("last_message_at", { ascending: false })
    .limit(50);

  for (const conv of (data ?? []) as Array<{
    id: string;
    participants: unknown;
  }>) {
    const list = Array.isArray(conv.participants) ? conv.participants : [];
    const ids = list
      .map((p) =>
        p && typeof p === "object"
          ? (p as Record<string, unknown>).patient_id ??
            (p as Record<string, unknown>).provider_id ??
            (p as Record<string, unknown>).id
          : p
      )
      .filter(Boolean) as string[];
    if (ids.includes(patientId) && ids.includes(providerId)) {
      return conv.id;
    }
  }
  return null;
}

/**
 * GET /api/messages?patient_id=&provider_id=  (or ?conversation_id=)
 * Returns the message thread for a patient/provider pair.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let conversationId = searchParams.get("conversation_id");
  const patientId = searchParams.get("patient_id");
  const providerId = searchParams.get("provider_id");

  if (!conversationId) {
    if (!patientId || !providerId) {
      return fail(
        "Provide conversation_id, or both patient_id and provider_id",
        400
      );
    }
    conversationId = await findPairConversation(patientId, providerId);
    if (!conversationId) {
      return ok({ conversation_id: null, messages: [] });
    }
  }

  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) return dbError(error);
  return ok({ conversation_id: conversationId, messages: data ?? [] });
}

/** POST /api/messages — send a message between a patient and provider. */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, sendSchema);
  if (error) return error;

  const senderId =
    data.sender_type === "patient" ? data.patient_id : data.provider_id;
  const recipientIsProvider = data.sender_type === "patient";
  const recipientId = recipientIsProvider ? data.provider_id : data.patient_id;

  // 1. Resolve or create the conversation.
  let conversationId =
    data.conversation_id ??
    (await findPairConversation(data.patient_id, data.provider_id)) ??
    undefined;

  if (!conversationId) {
    const { data: conv, error: convErr } = await supabaseAdmin
      .from("conversations")
      .insert({
        conversation_type: "provider_patient",
        participants: [
          { patient_id: data.patient_id },
          { provider_id: data.provider_id },
        ],
        is_clinical: true,
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (convErr) return dbError(convErr);
    conversationId = conv.id;
  }

  // 2. Save the message.
  const isUrgent = Boolean(data.urgent_concern);
  const severity = data.severity ?? 0;
  const messagePayload = {
    conversation_id: conversationId,
    sender_id: senderId,
    sender_type: data.sender_type,
    content: data.content,
    message_type: isUrgent ? "urgent" : "general",
    flagged: isUrgent && severity >= URGENT_SEVERITY_THRESHOLD,
    is_clinical: true,
  };
  console.log("[messages] inserting message:", messagePayload);

  const { data: message, error: msgErr } = await supabaseAdmin
    .from("messages")
    .insert(messagePayload)
    .select()
    .single();

  if (msgErr) {
    console.error("[messages] message insert failed:", {
      code: msgErr.code,
      message: msgErr.message,
      details: msgErr.details,
      hint: msgErr.hint,
      payload: messagePayload,
    });
    return dbError(msgErr);
  }

  console.log("[messages] message inserted:", message);

  await supabaseAdmin
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  // 3. Load recipient + provider contact info.
  const [{ data: recipientProvider }, { data: recipientPatient }] =
    await Promise.all([
      recipientIsProvider
        ? supabaseAdmin
            .from("providers")
            .select("id, first_name, last_name, phone")
            .eq("id", recipientId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      recipientIsProvider
        ? Promise.resolve({ data: null })
        : supabaseAdmin
            .from("patients")
            .select("id, first_name, phone")
            .eq("id", recipientId)
            .maybeSingle(),
    ]);

  // 4. Urgent escalation: alert the provider and Patrick (owner) by SMS.
  const escalated = isUrgent && severity >= URGENT_SEVERITY_THRESHOLD;
  if (escalated) {
    const { data: provider } = await supabaseAdmin
      .from("providers")
      .select("id, phone")
      .eq("id", data.provider_id)
      .maybeSingle();

    await Promise.all([
      sendSms(
        provider?.phone,
        `URGENT patient message (severity ${severity}/10). Please review in the portal immediately.`,
        {
          recipientType: "provider",
          recipientId: data.provider_id,
          subject: "Urgent patient message",
        }
      ),
      sendSms(
        process.env.OWNER_PHONE,
        `URGENT message flagged (severity ${severity}/10) for provider ${data.provider_id}. Patient ${data.patient_id}.`,
        { recipientType: "owner", subject: "Urgent message alert" }
      ),
    ]);
  }

  // 5. Notify the recipient of the new message.
  const recipientPhone = recipientIsProvider
    ? recipientProvider?.phone
    : recipientPatient?.phone;
  const recipientSms = await sendSms(
    recipientPhone,
    `You have a new secure message in your PsychRx portal.`,
    {
      recipientType: recipientIsProvider ? "provider" : "patient",
      recipientId,
      subject: "New message",
    }
  );

  return ok(
    {
      message,
      conversation_id: conversationId,
      escalated,
      notifications: { recipient_sms: !recipientSms.skipped },
    },
    201
  );
}
