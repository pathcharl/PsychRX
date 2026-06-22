import { type NextRequest } from "next/server";
import { z } from "zod";
import { anthropic, DEFAULT_CLAUDE_MODEL } from "@/lib/anthropic";
import { fail, parseBody } from "@/lib/api";

export const runtime = "nodejs";

const generateSchema = z.object({
  summary: z.string().min(10),
  session_type: z.string(),
  modality: z.string(),
  appointment_id: z.string().uuid().optional(),
  patient_name: z.string().optional(),
});

/** POST /api/portal/scribe/generate — stream AI clinical note. */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, generateSchema);
  if (error) return error;

  if (!process.env.ANTHROPIC_API_KEY) {
    return fail("AI service not configured", 503);
  }

  const system = `You are a psychiatric clinical documentation assistant. Generate a complete SOAP-format clinical note based on the provider's brief session summary. Include:
- Subjective: patient report and symptoms
- Objective: mental status exam findings (inferred appropriately)
- Assessment: clinical impression and diagnosis codes (ICD-10)
- Plan: medications, therapy, follow-up

Be concise but clinically complete. Use professional medical language.`;

  const prompt = `Patient: ${data.patient_name ?? "Patient"}
Session type: ${data.session_type}
Modality: ${data.modality}

Provider summary:
${data.summary}

Generate the complete clinical note:`;

  try {
    const stream = anthropic.messages.stream({
      model: DEFAULT_CLAUDE_MODEL,
      max_tokens: 4096,
      system,
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
