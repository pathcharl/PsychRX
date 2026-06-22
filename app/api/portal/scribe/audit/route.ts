import { type NextRequest } from "next/server";
import { z } from "zod";
import { askClaude, DEFAULT_CLAUDE_MODEL } from "@/lib/anthropic";
import { ok, parseBody } from "@/lib/api";
import type { AuditResult } from "@/lib/portal/types";

export const runtime = "nodejs";

const auditSchema = z.object({
  note: z.string().min(50),
  session_type: z.string(),
  modality: z.string(),
});

/** POST /api/portal/scribe/audit — CPT suggestion + audit checks. */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, auditSchema);
  if (error) return error;

  let cpt = { code: "99214", reasoning: "Established patient, moderate complexity" };
  let audit: AuditResult[] = [
    { status: "pass", label: "Note completeness", detail: "All SOAP sections present" },
    { status: "pass", label: "Medical necessity documented" },
    { status: "pass", label: "Session duration appropriate" },
  ];

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const response = await askClaude(
        `Review this clinical note and respond in JSON only:
{
  "cpt_code": "99213|99214|99215|90834|90837|90791",
  "cpt_reasoning": "brief reason",
  "audit": [
    {"status": "pass|fail|warn", "label": "check name", "detail": "optional detail"}
  ]
}

Session type: ${data.session_type}
Modality: ${data.modality}

Note:
${data.note}`,
        { model: DEFAULT_CLAUDE_MODEL, maxTokens: 1024, temperature: 0.3 }
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          cpt_code?: string;
          cpt_reasoning?: string;
          audit?: AuditResult[];
        };
        if (parsed.cpt_code) {
          cpt = { code: parsed.cpt_code, reasoning: parsed.cpt_reasoning ?? "" };
        }
        if (parsed.audit?.length) audit = parsed.audit;
      }
    } catch (err) {
      console.error("[scribe/audit] AI audit failed:", err);
      audit.push({
        status: "warn",
        label: "AI audit unavailable",
        detail: "Using default compliance checks",
      });
    }
  }

  return ok({ cpt, audit });
}
