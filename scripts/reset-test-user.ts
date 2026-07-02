/**
 * Reset a test account so its email can be reused for QA.
 *
 * Deletes the Supabase auth user plus every linked patient / provider row and
 * their dependent records (appointments, slots, contracts, messages, etc.).
 * After running you can sign up / apply / book with the SAME email again.
 *
 * Usage:
 *   npm run reset:user -- you@example.com
 *   npx tsx --env-file=.env.local scripts/reset-test-user.ts you@example.com
 *
 * Safe to run repeatedly. Missing tables/columns are ignored (the schema
 * differs across environments), and each delete is best-effort.
 */
import { supabaseAdmin } from "@/lib/supabase";

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Usage: npm run reset:user -- <email>");
  process.exit(1);
}

/** Best-effort delete; logs the row count and never throws. */
async function del(table: string, column: string, value: string) {
  const { error, count } = await supabaseAdmin
    .from(table)
    .delete({ count: "exact" })
    .eq(column, value);
  if (error) {
    // Unknown table/column in this environment — skip quietly.
    console.log(`  · ${table}.${column}: skipped (${error.message})`);
    return;
  }
  if ((count ?? 0) > 0) console.log(`  · ${table}.${column}: deleted ${count}`);
}

/** Find rows in a table matching a column value; returns their ids. */
async function idsWhere(
  table: string,
  column: string,
  value: string
): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("id")
    .eq(column, value);
  if (error || !data) return [];
  return data.map((r) => r.id as string);
}

/** Delete conversations (and their messages) that include this participant id. */
async function deleteConversations(kind: "patient_id" | "provider_id", id: string) {
  const { data } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .contains("participants", [{ [kind]: id }]);
  const convIds = (data ?? []).map((c) => c.id as string);
  if (!convIds.length) return;
  await supabaseAdmin.from("messages").delete().in("conversation_id", convIds);
  await supabaseAdmin.from("conversations").delete().in("id", convIds);
  console.log(`  · conversations (${kind}): deleted ${convIds.length}`);
}

async function resetPatient(patientId: string) {
  console.log(`\nPatient ${patientId}`);
  await deleteConversations("patient_id", patientId);
  await del("superbills", "patient_id", patientId);
  await del("outcome_measures", "patient_id", patientId);
  await del("encounters", "patient_id", patientId);
  await del("appointments", "patient_id", patientId);
  await del("waitlist", "patient_id", patientId);
  await del("inbound_contacts", "patient_id", patientId);
  await del("patients", "id", patientId);
}

async function resetProvider(providerId: string) {
  console.log(`\nProvider ${providerId}`);
  await deleteConversations("provider_id", providerId);
  await del("provider_slots", "provider_id", providerId);
  await del("availability_templates", "provider_id", providerId);
  await del("blocked_dates", "provider_id", providerId);
  await del("provider_documents", "provider_id", providerId);
  await del("collaborative_agreements", "pmhnp_id", providerId);
  await del("contracts", "provider_id", providerId);
  await del("provider_payments", "provider_id", providerId);
  await del("provider_milestones", "provider_id", providerId);
  await del("encounters", "provider_id", providerId);
  await del("appointments", "provider_id", providerId);
  await del("inbound_contacts", "provider_id", providerId);
  await del("providers", "id", providerId);
}

/** Find the auth user id for an email by paging through the admin user list. */
async function findAuthUserId(target: string): Promise<string | null> {
  const perPage = 1000;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error || !data) return null;
    const match = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === target
    );
    if (match) return match.id;
    if (data.users.length < perPage) break;
  }
  return null;
}

async function main() {
  console.log(`Resetting test account: ${email}`);

  // Patients / providers can be linked by email directly.
  const patientIds = await idsWhere("patients", "email", email);
  const providerIds = await idsWhere("providers", "email", email);

  const authUserId = await findAuthUserId(email);

  // Also catch rows linked by user_id (in case email drifted).
  if (authUserId) {
    for (const id of await idsWhere("patients", "user_id", authUserId)) {
      if (!patientIds.includes(id)) patientIds.push(id);
    }
    for (const id of await idsWhere("providers", "user_id", authUserId)) {
      if (!providerIds.includes(id)) providerIds.push(id);
    }
  }

  for (const id of patientIds) await resetPatient(id);
  for (const id of providerIds) await resetProvider(id);

  if (authUserId) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
    if (error) {
      console.log(`\nAuth user: FAILED to delete (${error.message})`);
    } else {
      console.log(`\nAuth user ${authUserId}: deleted`);
    }
  } else {
    console.log("\nAuth user: none found for this email");
  }

  const removed =
    patientIds.length + providerIds.length + (authUserId ? 1 : 0);
  if (removed === 0) {
    console.log("\nNothing found for that email — it is already free to reuse.");
  } else {
    console.log(`\nDone. ${email} is now free to reuse for testing.`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("reset-test-user failed:", err);
  process.exit(1);
});
