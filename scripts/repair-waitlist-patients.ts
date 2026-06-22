/**
 * Restore patient rows referenced by waitlist entries but missing from patients.
 * Run: npx tsx --env-file=.env.local scripts/repair-waitlist-patients.ts
 */
import { supabaseAdmin } from "@/lib/supabase";

const PATIENT_COLS =
  "id, first_name, last_name, phone, status, insurance_primary_payer_name, preferred_language, preferred_provider_type";

async function main() {
  const { data: waiting, error } = await supabaseAdmin
    .from("waitlist")
    .select("patient_id, care_type, language, insurance, insurance_payer, source")
    .eq("status", "waiting");

  if (error) {
    console.error("waitlist query failed:", error.message);
    process.exit(1);
  }

  const byPatient = new Map<
    string,
    {
      care_type: string | null;
      language: string | null;
      insurance: string | null;
      source: string | null;
    }
  >();

  for (const row of waiting ?? []) {
    const id = String(row.patient_id).trim();
    if (!byPatient.has(id)) {
      byPatient.set(id, {
        care_type: (row.care_type as string | null) ?? null,
        language: (row.language as string | null) ?? null,
        insurance:
          (row.insurance as string | null) ??
          (row.insurance_payer as string | null) ??
          null,
        source: (row.source as string | null) ?? null,
      });
    }
  }

  let created = 0;
  let existing = 0;

  for (const [id, meta] of Array.from(byPatient.entries())) {
    const { data: found } = await supabaseAdmin
      .from("patients")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (found) {
      existing += 1;
      console.log(`ok  patient ${id} already exists`);
      continue;
    }

    const { data, error: insertErr } = await supabaseAdmin
      .from("patients")
      .insert({
        id,
        first_name: "Waitlist",
        last_name: "Patient",
        status: "active",
        preferred_language: meta.language ?? "English",
        preferred_provider_type: meta.care_type,
        insurance_primary_payer_name: meta.insurance,
        referral_source: meta.source,
      })
      .select(PATIENT_COLS)
      .maybeSingle();

    if (insertErr) {
      console.error(`fail patient ${id}:`, insertErr.message);
      continue;
    }

    created += 1;
    console.log(`new patient ${id}:`, data);
  }

  console.log(`done: created=${created} existing=${existing} total=${byPatient.size}`);
}

void main();
