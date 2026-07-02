/**
 * Activate a provider account by email (QA/admin convenience).
 *
 * New provider signups are created as 'pending' and can't access the portal
 * until vetted. Use this to flip a test/known provider to 'active'.
 *
 * Usage:
 *   npm run activate:provider -- you@example.com
 *   npx tsx --env-file=.env.local scripts/activate-provider.ts you@example.com
 */
import { supabaseAdmin } from "@/lib/supabase";

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Usage: npm run activate:provider -- <email>");
  process.exit(1);
}

async function main() {
  const { data, error } = await supabaseAdmin
    .from("providers")
    .update({ status: "active" })
    .ilike("email", email)
    .select("id, first_name, last_name, email, status");

  if (error) {
    console.error("Failed to activate provider:", error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log(`No provider found with email ${email}.`);
    process.exit(0);
  }

  for (const p of data) {
    console.log(
      `Activated: ${p.first_name ?? ""} ${p.last_name ?? ""} <${p.email}> (${p.id}) → status=${p.status}`
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("activate-provider failed:", err);
  process.exit(1);
});
