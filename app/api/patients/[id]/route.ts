import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody, dbError } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: { id: string } };

const patientUpdateSchema = z
  .object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    date_of_birth: z.string().nullish(),
    gender: z
      .enum(["male", "female", "nonbinary", "other", "unknown"])
      .nullish(),
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
    status: z.enum(["prospective", "active", "inactive", "discharged"]),
  })
  .partial();

const idSchema = z.string().uuid();

/** GET /api/patients/:id */
export async function GET(_req: NextRequest, { params }: Params) {
  if (!idSchema.safeParse(params.id).success) return fail("Invalid id", 400);

  const { data, error } = await supabaseAdmin
    .from("patients")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return dbError(error);
  if (!data) return fail("Patient not found", 404);
  return ok({ patient: data });
}

/** PUT /api/patients/:id */
export async function PUT(req: NextRequest, { params }: Params) {
  if (!idSchema.safeParse(params.id).success) return fail("Invalid id", 400);

  const { data, error } = await parseBody(req, patientUpdateSchema);
  if (error) return error;
  if (Object.keys(data).length === 0) return fail("No fields to update", 400);

  const { data: updated, error: dbErr } = await supabaseAdmin
    .from("patients")
    .update(data)
    .eq("id", params.id)
    .select()
    .maybeSingle();

  if (dbErr) return dbError(dbErr);
  if (!updated) return fail("Patient not found", 404);
  return ok({ patient: updated });
}

/** DELETE /api/patients/:id */
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!idSchema.safeParse(params.id).success) return fail("Invalid id", 400);

  const { data, error } = await supabaseAdmin
    .from("patients")
    .delete()
    .eq("id", params.id)
    .select()
    .maybeSingle();

  if (error) return dbError(error);
  if (!data) return fail("Patient not found", 404);
  return ok({ success: true, patient: data });
}
