import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, parseBody, dbError } from "@/lib/api";

export const runtime = "nodejs";

const dismissSchema = z.object({ payment_id: z.string().uuid() });

/** POST /api/portal/celebration — dismiss payment celebration banner. */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, dismissSchema);
  if (error) return error;

  const { error: dbErr } = await supabaseAdmin
    .from("provider_payments")
    .update({ celebration_shown: true })
    .eq("id", data.payment_id);

  if (dbErr) return dbError(dbErr);
  return ok({ dismissed: true });
}
