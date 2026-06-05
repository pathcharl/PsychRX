import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, parseBody, dbError } from "@/lib/api";

export const runtime = "nodejs";

const providerCreateSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  credentials: z.string().nullish(),
  specialty: z.string().nullish(),
  npi: z.string().nullish(),
  dea_number: z.string().nullish(),
  license_number: z.string().nullish(),
  license_state: z.string().nullish(),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  status: z.enum(["active", "inactive", "pending"]).optional(),
});

/** GET /api/providers — list providers (optional ?status= & ?search=). */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  let query = supabaseAdmin
    .from("providers")
    .select("*")
    .order("last_name", { ascending: true });

  if (status) query = query.eq("status", status);
  if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) return dbError(error);
  return ok({ providers: data });
}

/** POST /api/providers — create a provider. */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, providerCreateSchema);
  if (error) return error;

  const { data: created, error: dbErr } = await supabaseAdmin
    .from("providers")
    .insert(data)
    .select()
    .single();

  if (dbErr) return dbError(dbErr);
  return ok({ provider: created }, 201);
}
