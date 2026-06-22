import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, parseBody, dbError } from "@/lib/api";

export const runtime = "nodejs";

const messageSchema = z.object({
  provider_id: z.string().uuid(),
  content: z.string().min(1),
  conversation_id: z.string().uuid().optional(),
  patient_id: z.string().uuid().optional(),
});

/** POST /api/portal/messages — send a provider message. */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, messageSchema);
  if (error) return error;

  console.log("[portal/messages] POST parsed body:", data);

  let conversationId = data.conversation_id;

  if (!conversationId) {
    const conversationPayload = {
      conversation_type: "provider_patient",
      participants: [{ provider_id: data.provider_id }],
      is_clinical: true,
      last_message_at: new Date().toISOString(),
    };
    console.log("[portal/messages] inserting conversation:", conversationPayload);

    const { data: conv, error: convErr } = await supabaseAdmin
      .from("conversations")
      .insert(conversationPayload)
      .select("id")
      .single();

    if (convErr) {
      console.error("[portal/messages] conversation insert failed:", {
        code: convErr.code,
        message: convErr.message,
        details: convErr.details,
        hint: convErr.hint,
      });
      return dbError(convErr);
    }

    console.log("[portal/messages] conversation inserted:", conv);
    conversationId = conv.id;
  } else {
    console.log("[portal/messages] using existing conversation_id:", conversationId);
  }

  const messagePayload = {
    conversation_id: conversationId,
    sender_id: data.provider_id,
    sender_type: "provider",
    content: data.content,
    is_clinical: true,
  };
  console.log("[portal/messages] inserting message:", messagePayload);

  const { data: message, error: msgErr } = await supabaseAdmin
    .from("messages")
    .insert(messagePayload)
    .select()
    .single();

  if (msgErr) {
    console.error("[portal/messages] message insert failed:", {
      code: msgErr.code,
      message: msgErr.message,
      details: msgErr.details,
      hint: msgErr.hint,
      payload: messagePayload,
    });
    return dbError(msgErr);
  }

  console.log("[portal/messages] message inserted:", message);

  const { error: convUpdateErr } = await supabaseAdmin
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (convUpdateErr) {
    console.error("[portal/messages] conversation last_message_at update failed:", {
      code: convUpdateErr.code,
      message: convUpdateErr.message,
      conversationId,
    });
  }

  return ok({ message }, 201);
}
