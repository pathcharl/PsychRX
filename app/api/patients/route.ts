import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, parseBody, dbError } from "@/lib/api";

export const runtime = "nodejs";

const patientCreateSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  date_of_birth: z.string().nullish(),
  gender: z.enum(["male", "female", "nonbinary", "other", "unknown"]).nullish(),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  address_line1: z.string().nullish(),
  address_line2: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  zip: z.string().nullish(),
  insurance_provider: z.string().nullish(),
  insurance_member_id: z.string().nullish(),
  insurance_group_number: z.string().nullish(),
  primary_provider_id: z.string().uuid().nullish(),
  referral_source_id: z.string().uuid().nullish(),
  status: z
    .enum(["prospective", "active", "inactive", "discharged"])
    .optional(),
});

/** GET /api/patients — list patients (optional ?status=, ?provider_id=, ?search=). */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const providerId = searchParams.get("provider_id");
  const search = searchParams.get("search");

  let query = supabaseAdmin
    .from("patients")
    .select("*")
    .order("last_name", { ascending: true });

  if (status) query = query.eq("status", status);
  if (providerId) query = query.eq("primary_provider_id", providerId);
  if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) return dbError(error);
  return ok({ patients: data });
}

/** POST /api/patients — create a patient. */
export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, patientCreateSchema);
  if (error) return error;

  const { data: created, error: dbErr } = await supabaseAdmin
    .from("patients")
    .insert(data)
    .select()
    .single();

  if (dbErr) return dbError(dbErr);
  return ok({ patient: created }, 201);
}
