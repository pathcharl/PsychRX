// ============================================================================
// Carol — PsychRx's AI voice receptionist.
//   * Anthropic Claude understands the caller and drives the conversation
//   * ElevenLabs renders Carol's replies to speech (CAROL_VOICE_ID)
//   * Conversation state + intake data persist in `ai_interactions`
// Carol is warm, professional, and efficient.
// ============================================================================
import { anthropic, DEFAULT_CLAUDE_MODEL } from "@/lib/anthropic";
import { textToSpeechBuffer } from "@/lib/elevenlabs";
import { supabaseAdmin } from "@/lib/supabase";
import { uploadPublic } from "@/lib/storage";
import { toE164 } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

const CAROL_BUCKET = process.env.CAROL_AUDIO_BUCKET ?? "carol-audio";
const MAX_TURNS = Number(process.env.CAROL_MAX_TURNS ?? 25);

export const CAROL_GREETING =
  `Thank you for calling ${APP_NAME}. This is Carol, your virtual assistant. ` +
  `I can help you book an appointment or get you to the right place. ` +
  `To start, may I have your first and last name?`;

const SYSTEM_PROMPT = `You are Carol, the AI receptionist for ${APP_NAME}, a psychiatric practice. You are speaking with a caller on the phone, so keep replies short, warm, professional, and efficient (1-3 sentences, easy to listen to). Never give medical advice. If the caller is in crisis or mentions self-harm, calmly tell them to call or text 988 (Suicide & Crisis Lifeline) or 911, and set action to "transfer".

Your job is to greet callers, collect new-patient intake information, and book appointments. Collect, one or two items at a time: first_name, last_name, dob (date of birth), phone, email (optional), reason (reason for visit), insurance, and preferred_times. Confirm spellings of names and the phone number. Once you have enough information and the caller has agreed to a specific date and time, book the appointment.

You MUST respond with ONLY a single JSON object (no markdown, no prose) of the form:
{
  "say": "what you will say next to the caller",
  "intent": "new_patient_intake | appointment_booking | billing | prescription_refill | general",
  "collected": { "first_name": "", "last_name": "", "dob": "", "phone": "", "email": "", "reason": "", "insurance": "", "preferred_times": "" },
  "action": "collect | book | transfer | end",
  "booking": { "start_iso": "ISO 8601 datetime", "appointment_type": "intake" } | null
}

Rules:
- Include in "collected" only fields you have actually learned (omit unknown ones).
- Use action "collect" while still gathering info.
- Use action "book" ONLY when the caller has confirmed a specific date and time; then set "booking.start_iso" to that time in ISO 8601 and "booking.appointment_type" to "intake".
- Use action "transfer" to hand off to a human (billing, refills, crises, or if asked).
- Use action "end" to wrap up after a successful booking or if the caller is done.`;

export type CarolAction = "collect" | "book" | "transfer" | "end";

interface TranscriptTurn {
  role: "assistant" | "user";
  text: string;
  at: string;
}

interface Interaction {
  id: string;
  call_sid: string | null;
  from_number: string | null;
  to_number: string | null;
  patient_id: string | null;
  collected: Record<string, unknown>;
  transcript: TranscriptTurn[];
  turns: number;
}

export interface CarolTurnResult {
  say: string;
  audioUrl: string | null;
  action: CarolAction;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function getInteraction(callSid: string): Promise<Interaction | null> {
  const { data } = await supabaseAdmin
    .from("ai_interactions")
    .select("id, call_sid, from_number, to_number, patient_id, collected, transcript, turns")
    .eq("call_sid", callSid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Interaction | null) ?? null;
}

/** Create the interaction row and record Carol's greeting. */
export async function startCarolCall(input: {
  callSid: string;
  from?: string | null;
  to?: string | null;
}): Promise<{ say: string; audioUrl: string | null }> {
  await supabaseAdmin.from("ai_interactions").insert({
    agent: "carol",
    channel: "voice",
    call_sid: input.callSid,
    from_number: input.from ? toE164(input.from) || input.from : null,
    to_number: input.to ?? null,
    status: "in_progress",
    model: DEFAULT_CLAUDE_MODEL,
    transcript: [{ role: "assistant", text: CAROL_GREETING, at: new Date().toISOString() }],
    turns: 0,
  });

  const audioUrl = await synthesizeCarolAudio(CAROL_GREETING, `${input.callSid}-greeting`);
  return { say: CAROL_GREETING, audioUrl };
}

// ---------------------------------------------------------------------------
// Voice synthesis
// ---------------------------------------------------------------------------

/** Render text with Carol's ElevenLabs voice and return a public URL (or null). */
export async function synthesizeCarolAudio(
  text: string,
  key: string
): Promise<string | null> {
  try {
    const audio = await textToSpeechBuffer(text);
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "-");
    return await uploadPublic(CAROL_BUCKET, `${safeKey}.mp3`, audio, "audio/mpeg");
  } catch (err) {
    // No ElevenLabs key / storage issue → caller falls back to Twilio <Say>.
    console.error("[carol] voice synthesis failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Claude brain
// ---------------------------------------------------------------------------

interface CarolDecision {
  say: string;
  intent?: string;
  collected?: Record<string, unknown>;
  action?: CarolAction;
  booking?: { start_iso?: string; appointment_type?: string } | null;
}

function parseDecision(raw: string): CarolDecision {
  try {
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return json as CarolDecision;
  } catch {
    return { say: raw.trim() || "I'm sorry, could you repeat that?", action: "collect" };
  }
}

/** Turn the stored transcript into Claude messages (must start with the caller). */
function buildMessages(
  transcript: TranscriptTurn[]
): { role: "user" | "assistant"; content: string }[] {
  const turns = transcript.map((t) => ({ role: t.role, content: t.text }));
  // Drop leading assistant turns (e.g. the greeting) so it starts with "user".
  while (turns.length && turns[0].role === "assistant") turns.shift();
  return turns as { role: "user" | "assistant"; content: string }[];
}

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

async function pickProvider(): Promise<{ id: string } | null> {
  const { data } = await supabaseAdmin
    .from("providers")
    .select("id")
    .eq("status", "active")
    .eq("available", true)
    .order("created_at", { ascending: true })
    .limit(1);
  return (data?.[0] as { id: string } | undefined) ?? null;
}

async function findOrCreatePatient(
  collected: Record<string, unknown>,
  fromNumber: string | null
): Promise<string | null> {
  const phone = toE164(fromNumber) || toE164(String(collected.phone ?? ""));
  if (phone) {
    const { data } = await supabaseAdmin
      .from("patients")
      .select("id")
      .eq("phone", phone)
      .limit(1);
    if (data?.[0]) return (data[0] as { id: string }).id;
  }

  const firstName = String(collected.first_name ?? "").trim() || "Unknown";
  const lastName = String(collected.last_name ?? "").trim() || "Caller";
  const { data, error } = await supabaseAdmin
    .from("patients")
    .insert({
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      email: collected.email ? String(collected.email) : null,
      date_of_birth: collected.dob ? String(collected.dob) : null,
      insurance_provider: collected.insurance ? String(collected.insurance) : null,
      status: "prospective",
    })
    .select("id")
    .maybeSingle();
  if (error) return null;
  return (data as { id: string } | null)?.id ?? null;
}

async function bookAppointment(
  interaction: Interaction,
  collected: Record<string, unknown>,
  booking: { start_iso?: string; appointment_type?: string }
): Promise<{ patientId: string; appointmentId: string } | null> {
  if (!booking.start_iso) return null;
  const start = new Date(booking.start_iso);
  if (Number.isNaN(start.getTime())) return null;

  const provider = await pickProvider();
  if (!provider) return null;

  const patientId =
    interaction.patient_id ?? (await findOrCreatePatient(collected, interaction.from_number));
  if (!patientId) return null;

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .insert({
      patient_id: patientId,
      provider_id: provider.id,
      appointment_type: booking.appointment_type ?? "intake",
      status: "scheduled",
      scheduled_start: start.toISOString(),
      notes: `Booked via Carol AI. Reason: ${collected.reason ?? "n/a"}`,
    })
    .select("id")
    .maybeSingle();
  if (error) return null;
  return { patientId, appointmentId: (data as { id: string }).id };
}

// ---------------------------------------------------------------------------
// Main turn handler
// ---------------------------------------------------------------------------

/**
 * Process one caller utterance: update Claude, persist state, optionally book,
 * and synthesize Carol's spoken reply.
 */
export async function handleCarolTurn(input: {
  callSid: string;
  from?: string | null;
  to?: string | null;
  speech: string;
}): Promise<CarolTurnResult> {
  const interaction = await getInteraction(input.callSid);
  if (!interaction) {
    // No session (e.g. cold start) — greet and create one.
    const greet = await startCarolCall({ callSid: input.callSid, from: input.from, to: input.to });
    return { say: greet.say, audioUrl: greet.audioUrl, action: "collect" };
  }

  const speech = (input.speech ?? "").trim();
  const transcript = Array.isArray(interaction.transcript) ? interaction.transcript : [];
  if (speech) transcript.push({ role: "user", text: speech, at: new Date().toISOString() });

  // Ask Claude for the next step.
  const response = await anthropic.messages.create({
    model: DEFAULT_CLAUDE_MODEL,
    max_tokens: 700,
    temperature: 0.5,
    system: SYSTEM_PROMPT,
    messages: buildMessages(transcript),
  });
  const raw = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");
  const decision = parseDecision(raw);

  const collected = { ...interaction.collected, ...(decision.collected ?? {}) };
  let action: CarolAction = decision.action ?? "collect";
  let say = decision.say?.trim() || "Thank you. How else can I help?";

  // Attempt booking when requested.
  let patientId = interaction.patient_id;
  let appointmentId: string | null = null;
  if (action === "book" && decision.booking) {
    const booked = await bookAppointment(interaction, collected, decision.booking);
    if (booked) {
      patientId = booked.patientId;
      appointmentId = booked.appointmentId;
    } else {
      // Booking couldn't complete — keep the caller engaged.
      action = "collect";
      say =
        "I want to make sure I book the right time. What day and time works best for you?";
    }
  }

  transcript.push({ role: "assistant", text: say, at: new Date().toISOString() });
  const turns = (interaction.turns ?? 0) + 1;
  if (turns >= MAX_TURNS && action === "collect") action = "transfer";

  const status =
    action === "end" ? "completed" : action === "transfer" ? "transferred" : "in_progress";

  await supabaseAdmin
    .from("ai_interactions")
    .update({
      transcript,
      collected,
      intent: decision.intent ?? null,
      turns,
      status,
      patient_id: patientId,
      appointment_id: appointmentId ?? undefined,
    })
    .eq("id", interaction.id);

  const audioUrl = await synthesizeCarolAudio(say, `${input.callSid}-${turns}`);
  return { say, audioUrl, action };
}
