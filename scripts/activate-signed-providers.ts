/**
 * One-off backfill: activate providers who have already signed their contract
 * but whose status was never flipped to "active" (pre-fix records).
 *
 * Run: npx tsx scripts/activate-signed-providers.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Minimal .env.local loader (standalone scripts don't get Next's env injection).
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
    // ignore if file is missing
  }
}

async function main() {
  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: stuck, error: selErr } = await admin
    .from("providers")
    .select("id, email, first_name, last_name, status, contract_signed")
    .eq("contract_signed", true)
    .neq("status", "active");

  if (selErr) {
    console.error("Select failed:", selErr.message);
    process.exit(1);
  }

  if (!stuck || stuck.length === 0) {
    console.log("No stuck providers — everyone who signed is already active.");
    return;
  }

  console.log(`Found ${stuck.length} signed-but-inactive provider(s):`);
  for (const p of stuck) {
    console.log(`  - ${p.email} (${p.first_name} ${p.last_name}) status=${p.status}`);
  }

  const { error: updErr } = await admin
    .from("providers")
    .update({ status: "active" })
    .eq("contract_signed", true)
    .neq("status", "active");

  if (updErr) {
    console.error("Update failed:", updErr.message);
    process.exit(1);
  }

  console.log("Activated all signed providers.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
