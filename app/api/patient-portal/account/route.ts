import { type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { ok, fail, parseBody } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { getPortalPatient } from "@/lib/patient-portal/auth";

export const runtime = "nodejs";

const updateSchema = z.object({
  email: z.string().email().or(z.literal("")).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  emergency_contact_relationship: z.string().optional(),
  preferred_pharmacy: z.string().optional(),
  session_modality_preference: z.enum(["video", "phone", "either"]).optional(),
  sms_opted_out: z.boolean().optional(),
});

// The deployed `patients` table is a hybrid of several migrations, so some
// columns (e.g. address vs address_line1, preferred_pharmacy,
// session_modality_preference) may not physically exist in every environment.
// Update defensively: try the combined update first, then retry each field
// individually so a single missing column never aborts the whole save.
async function updatePatientFields(
  id: string,
  fields: Record<string, unknown>
): Promise<number> {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return 0;

  const { error } = await supabaseAdmin
    .from("patients")
    .update(Object.fromEntries(entries))
    .eq("id", id);
  if (!error) return entries.length;

  let updated = 0;
  for (const [key, value] of entries) {
    const { error: fieldErr } = await supabaseAdmin
      .from("patients")
      .update({ [key]: value })
      .eq("id", id);
    if (!fieldErr) {
      updated += 1;
      continue;
    }
    // Fall back to the legacy column name for the street address.
    if (key === "address") {
      const { error: legacyErr } = await supabaseAdmin
        .from("patients")
        .update({ address_line1: value })
        .eq("id", id);
      if (!legacyErr) updated += 1;
    }
  }
  return updated;
}

/** PATCH — update the authenticated patient's own profile fields. */
export async function PATCH(req: NextRequest) {
  const user = await getUser();
  if (!user) return fail("Not authenticated", 401);

  const patient = await getPortalPatient(user);
  if (!patient) return fail("No patient profile found for this account", 403);

  const { data, error } = await parseBody(req, updateSchema);
  if (error) return error;

  const updated = await updatePatientFields(
    patient.id,
    data as Record<string, unknown>
  );
  if (updated === 0) {
    return fail("No changes could be saved.", 400);
  }

  return ok({ updated });
}
