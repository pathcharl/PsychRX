import { type NextRequest } from "next/server";
import { z } from "zod";
import { anthropic, DEFAULT_CLAUDE_MODEL } from "@/lib/anthropic";
import { fail, parseBody } from "@/lib/api";
import { CPT_CODES, SESSION_TYPES } from "@/lib/constants";

export const runtime = "nodejs";

const generateSchema = z.object({
  appointment_id: z.string().uuid().optional(),
  session_summary: z.string().min(10),
  session_type: z.string().min(1),
  patient_name: z.string().optional(),
});

const CPT_REFERENCE = CPT_CODES.map(
  (c) => `${c.code} — ${c.description}`
).join("\n");

const SYSTEM_PROMPT = `You are a psychiatric clinical documentation assistant for a behavioral-health practice. From the provider's brief session summary, produce a complete, audit-ready clinical note.

Output the following sections, in this order, using Markdown headers:

## Clinical Note (SOAP)
- **Subjective:** patient report, history of present illness, relevant symptoms.
- **Objective:** mental status exam findings (inferred conservatively and clearly labeled as such where not explicitly stated).
- **Assessment:** clinical impression with ICD-10 diagnosis code(s).
- **Plan:** medications (with rationale), therapy, safety planning, and follow-up interval.

## Suggested CPT Code
Recommend ONE primary CPT code from the reference list that best matches the session, plus any appropriate add-on code. State the code, its description, and a one-line rationale tied to time/complexity.

## Audit & Compliance Checklist
A checklist (use "- [ ]"/"- [x]") confirming documentation completeness: time/duration documented, medical necessity established, diagnosis supports CPT, MSE present, risk assessment addressed, medication reconciliation, follow-up plan, and provider attestation.

Be concise but clinically complete. Use professional medical language. Never fabricate specific vitals or lab values; flag anything that requires provider confirmation with "[confirm]".

CPT reference list:
${CPT_REFERENCE}`;

/**
 * POST /api/scribe/generate — stream an AI-generated clinical note, including
 * a CPT-code suggestion and an audit checklist.
 */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, generateSchema);
  if (error) return error;

  if (!process.env.ANTHROPIC_API_KEY) {
    return fail("AI service not configured", 503);
  }

  const sessionMeta = SESSION_TYPES.find((s) => s.value === data.session_type);
  const sessionLabel = sessionMeta?.label ?? data.session_type;
  const defaultCpt = sessionMeta
    ? ` (typical CPT for this visit type: ${sessionMeta.defaultCpt})`
    : "";

  const prompt = `Patient: ${data.patient_name ?? "Patient"}
Session type: ${sessionLabel}${defaultCpt}
${data.appointment_id ? `Appointment ID: ${data.appointment_id}\n` : ""}
Provider session summary:
${data.session_summary}

Generate the complete clinical note, CPT suggestion, and audit checklist now:`;

  try {
    const stream = anthropic.messages.stream({
      model: DEFAULT_CLAUDE_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
        } catch (err) {
          console.error("[scribe/generate] stream error:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Generation failed", 500);
  }
}
