import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody } from "@/lib/api";
import { getAdminApiUser } from "@/lib/admin/auth";

export const runtime = "nodejs";

const balanceSchema = z
  .object({
    referral_pct: z.number().int().min(0).max(100),
    recruit_pct: z.number().int().min(0).max(100),
    reasoning: z.string().max(1000).optional(),
    urgency: z.enum(["low", "medium", "high"]).default("low"),
  })
  .refine((d) => d.referral_pct + d.recruit_pct === 100, {
    message: "referral_pct and recruit_pct must sum to 100",
    path: ["recruit_pct"],
  });

/**
 * POST /api/admin/balance — manually override the fax-budget allocation
 * between patient-referral outreach and provider recruitment (admin only).
 * The decision is recorded to balance_decisions for the campaign worker/audit.
 */
export async function POST(req: NextRequest) {
  const admin = await getAdminApiUser();
  if (!admin) return fail("Admin access required", 401);

  const { data, error } = await parseBody(req, balanceSchema);
  if (error) return error;

  const decision = `manual_override: referral ${data.referral_pct}% / recruit ${data.recruit_pct}%`;
  const reasoning =
    data.reasoning ??
    `Manual allocation override by ${admin.email ?? admin.id}.`;

  const { data: row, error: dbErr } = await supabaseAdmin
    .from("balance_decisions")
    .insert({ decision, reasoning, urgency: data.urgency })
    .select()
    .single();

  if (dbErr) {
    console.error("[admin/balance] insert failed:", dbErr.message);
    return fail("Could not record balance decision", 500);
  }

  return ok(
    {
      decision: row,
      allocation: {
        referral: data.referral_pct / 100,
        recruit: data.recruit_pct / 100,
        referral_pct: data.referral_pct,
        recruit_pct: data.recruit_pct,
      },
    },
    201
  );
}
