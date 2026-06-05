import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody, dbError } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: { id: string } };

const providerUpdateSchema = z
  .object({
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
    status: z.enum(["active", "inactive", "pending"]),
  })
  .partial();

const idSchema = z.string().uuid();

/** GET /api/providers/:id */
export async function GET(_req: NextRequest, { params }: Params) {
  if (!idSchema.safeParse(params.id).success) return fail("Invalid id", 400);

  const { data, error } = await supabaseAdmin
    .from("providers")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return dbError(error);
  if (!data) return fail("Provider not found", 404);
  return ok({ provider: data });
}

/** PUT /api/providers/:id */
export async function PUT(req: NextRequest, { params }: Params) {
  if (!idSchema.safeParse(params.id).success) return fail("Invalid id", 400);

  const { data, error } = await parseBody(req, providerUpdateSchema);
  if (error) return error;
  if (Object.keys(data).length === 0) return fail("No fields to update", 400);

  const { data: updated, error: dbErr } = await supabaseAdmin
    .from("providers")
    .update(data)
    .eq("id", params.id)
    .select()
    .maybeSingle();

  if (dbErr) return dbError(dbErr);
  if (!updated) return fail("Provider not found", 404);
  return ok({ provider: updated });
}

/** DELETE /api/providers/:id */
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!idSchema.safeParse(params.id).success) return fail("Invalid id", 400);

  const { data, error } = await supabaseAdmin
    .from("providers")
    .delete()
    .eq("id", params.id)
    .select()
    .maybeSingle();

  if (error) return dbError(error);
  if (!data) return fail("Provider not found", 404);
  return ok({ success: true, provider: data });
}
