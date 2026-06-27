/**
 * Read-only diagnostic: why a provider does/doesn't appear on the public
 * "book an appointment" page.
 *
 * Run: npx tsx scripts/diagnose-providers.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  try {
    const file = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of file.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing env vars");
    process.exit(1);
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: providers, error } = await admin
    .from("providers")
    .select(
      "id, first_name, last_name, email, status, accepts_new_patients, provider_type, contract_signed, onboarding_step"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Select failed:", error.message);
    process.exit(1);
  }

  const now = new Date().toISOString();
  console.log(`Total providers: ${providers?.length ?? 0}\n`);

  for (const p of providers ?? []) {
    const { count } = await admin
      .from("provider_slots")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", p.id)
      .eq("status", "open")
      .gt("start_time", now);

    const visible =
      p.status === "active" &&
      p.accepts_new_patients === true &&
      (count ?? 0) > 0;

    console.log(
      `${visible ? "VISIBLE " : "HIDDEN  "} | ${p.first_name} ${p.last_name} <${p.email}>`
    );
    console.log(
      `          status=${p.status} accepts_new_patients=${p.accepts_new_patients} ` +
        `provider_type=${p.provider_type} contract_signed=${p.contract_signed} ` +
        `onboarding_step=${p.onboarding_step} openFutureSlots=${count ?? 0}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
