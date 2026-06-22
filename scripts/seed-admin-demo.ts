/**
 * Seed an admin user + demo data so the /admin dashboard has something to show.
 *
 * Run:  npx tsx --env-file=.env.local scripts/seed-admin-demo.ts
 *
 * Recommended first: run database/admin_demo_prep.sql in the Supabase SQL editor
 * so every column/table the admin pages read exists. This script is
 * schema-adaptive — it probes each table and only inserts columns that exist —
 * so it won't crash if some prep is missing, those fields just stay empty.
 *
 * Idempotent: re-running clears the previously seeded demo rows first
 * (everything is tagged with the @demo.psychrx.test domain / seed_demo marker).
 *
 * Override admin credentials with env vars:
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
 */
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

const DEMO_DOMAIN = "demo.psychrx.test";
const SEED_MARKER = "seed_demo";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? `admin@${DEMO_DOMAIN}`;
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!change";

type Row = Record<string, unknown>;

const log = (msg: string) => console.log(`  ${msg}`);

/** Return the subset of candidate columns that actually exist on the table. */
async function presentColumns(
  table: string,
  candidates: string[]
): Promise<Set<string>> {
  // Fast path: one request asking for all columns at once.
  const all = await supabaseAdmin.from(table).select(candidates.join(",")).limit(1);
  if (!all.error) return new Set(candidates);

  // Fallback: probe each column in parallel.
  const checks = await Promise.all(
    candidates.map(async (col) => {
      const { error } = await supabaseAdmin.from(table).select(col).limit(1);
      return [col, !error] as const;
    })
  );
  return new Set(checks.filter(([, ok]) => ok).map(([col]) => col));
}

function pick(row: Row, cols: Set<string>): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) if (cols.has(k)) out[k] = v;
  return out;
}

async function insertAll(table: string, rows: Row[]): Promise<void> {
  if (!rows.length) return;
  const cols = await presentColumns(table, Object.keys(rows[0]));
  const filtered = rows.map((r) => pick(r, cols));
  const { error } = await supabaseAdmin.from(table).insert(filtered);
  if (error) {
    log(`! ${table}: ${error.message}`);
  } else {
    log(`✓ ${table}: inserted ${rows.length}`);
  }
}

const daysFromNow = (d: number) =>
  new Date(Date.now() + d * 86_400_000).toISOString();
const minsFromNow = (m: number) =>
  new Date(Date.now() + m * 60_000).toISOString();
const dateOnly = (d: number) =>
  new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Cleanup of prior demo rows (respect FK order)
// ---------------------------------------------------------------------------
async function cleanup() {
  log("Clearing previous demo data…");

  const { data: provs } = await supabaseAdmin
    .from("providers")
    .select("id")
    .like("email", `%@${DEMO_DOMAIN}`);
  const provIds = (provs ?? []).map((p) => p.id as string);

  const { data: pats } = await supabaseAdmin
    .from("patients")
    .select("id")
    .like("email", `%@${DEMO_DOMAIN}`);
  const patIds = (pats ?? []).map((p) => p.id as string);

  const del = async (table: string, col: string, ids: string[]) => {
    if (!ids.length) return;
    await supabaseAdmin.from(table).delete().in(col, ids);
  };

  if (provIds.length) {
    await del("provider_payments", "provider_id", provIds);
    await del("insurance_claims", "provider_id", provIds);
    await del("encounters", "provider_id", provIds);
    await del("appointments", "provider_id", provIds);
    await del("provider_absences", "provider_id", provIds);
    await del("provider_onboarding_status", "provider_id", provIds);
  }
  await del("insurance_claims", "patient_id", patIds);
  await del("patients", "id", patIds);
  await del("providers", "id", provIds);

  await supabaseAdmin.from("outreach_contacts").delete().eq("source", SEED_MARKER);
  await supabaseAdmin
    .from("daily_send_log")
    .delete()
    .like("external_id", `${SEED_MARKER}%`);
  await supabaseAdmin
    .from("audit_log")
    .delete()
    .like("actor_email", `%@${DEMO_DOMAIN}`);
  await supabaseAdmin
    .from("balance_decisions")
    .delete()
    .like("reasoning", "[demo]%");
  await supabaseAdmin
    .from("campaign_config")
    .delete()
    .in("config_key", ["allocation_referral_pct", "allocation_recruit_pct"]);
}

// ---------------------------------------------------------------------------
// Admin auth user
// ---------------------------------------------------------------------------
async function ensureAdminUser() {
  log(`Ensuring admin user ${ADMIN_EMAIL}…`);

  const created = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Platform Admin" },
  });

  let userId = created.data.user?.id;

  if (created.error) {
    // Likely already registered — find the existing user.
    const { data } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const existing = data.users.find(
      (u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
    );
    userId = existing?.id;
    if (!userId) {
      log(`! Could not create or find admin user: ${created.error.message}`);
      return;
    }
    log("Admin user already existed — promoting to admin role.");
  }

  if (!userId) return;

  // The signup trigger clamps role to patient/provider; force admin here.
  await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: { role: "admin" },
  });

  // Remove the auto-created patient profile (admins don't need one).
  await supabaseAdmin.from("patients").delete().eq("user_id", userId);

  log(`✓ Admin ready — email: ${ADMIN_EMAIL}  password: ${ADMIN_PASSWORD}`);
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------
async function seed() {
  // Providers across pipeline stages -------------------------------------
  const p = Array.from({ length: 7 }, () => randomUUID());
  const providers: Row[] = [
    {
      id: p[0], first_name: "Maya", last_name: "Hassan", credentials: "PMHNP-BC",
      provider_type: "pmhnp", npi: "9000000001", email: `maya@${DEMO_DOMAIN}`,
      phone: "555-0101", license_state: "FL", status: "active", fill_rate: 0.88,
      contract_signed: true, stripe_onboarding_complete: true,
      license_expiry: dateOnly(220), malpractice_expiry: dateOnly(40),
      dea_expiry: dateOnly(400), caqh_last_attested: daysFromNow(-90),
      oig_excluded: false, oig_checked_at: daysFromNow(-7),
    },
    {
      id: p[1], first_name: "David", last_name: "Okafor", credentials: "MD",
      provider_type: "psychiatrist", npi: "9000000002", email: `david@${DEMO_DOMAIN}`,
      phone: "555-0102", license_state: "FL", status: "active", fill_rate: 0.74,
      contract_signed: true, stripe_onboarding_complete: true,
      license_expiry: dateOnly(15), malpractice_expiry: dateOnly(300),
      dea_expiry: dateOnly(20), caqh_last_attested: daysFromNow(-200),
      oig_excluded: true, oig_checked_at: daysFromNow(-3),
    },
    {
      id: p[2], first_name: "Priya", last_name: "Nair", credentials: "LCSW",
      provider_type: "therapist", npi: "9000000003", email: `priya@${DEMO_DOMAIN}`,
      phone: "555-0103", license_state: "GA", status: "active", fill_rate: 0.62,
      contract_signed: true, stripe_onboarding_complete: true,
      license_expiry: dateOnly(120), malpractice_expiry: dateOnly(90),
      dea_expiry: null, caqh_last_attested: daysFromNow(-30),
      oig_excluded: false, oig_checked_at: daysFromNow(-14),
    },
    {
      id: p[3], first_name: "Sam", last_name: "Reyes", credentials: "PsyD",
      provider_type: "psychologist", npi: "9000000004", email: `sam@${DEMO_DOMAIN}`,
      phone: "555-0104", license_state: "TX", status: "pending", fill_rate: 0.0,
      contract_signed: true, stripe_onboarding_complete: true,
      license_expiry: dateOnly(365), malpractice_expiry: dateOnly(365),
      dea_expiry: dateOnly(365), caqh_last_attested: null,
      oig_excluded: false, oig_checked_at: null,
    },
    {
      id: p[4], first_name: "Lena", last_name: "Brooks", credentials: "PMHNP-BC",
      provider_type: "pmhnp", npi: "9000000005", email: `lena@${DEMO_DOMAIN}`,
      phone: "555-0105", license_state: "FL", status: "pending", fill_rate: 0.0,
      contract_signed: true, stripe_onboarding_complete: false,
      license_expiry: dateOnly(180), malpractice_expiry: dateOnly(180),
      dea_expiry: dateOnly(180), caqh_last_attested: null,
      oig_excluded: false, oig_checked_at: null,
    },
    {
      id: p[5], first_name: "Tomás", last_name: "Vega", credentials: "LMHC",
      provider_type: "therapist", npi: "9000000006", email: `tomas@${DEMO_DOMAIN}`,
      phone: "555-0106", license_state: "NY", status: "pending", fill_rate: 0.0,
      contract_signed: false, stripe_onboarding_complete: false,
      license_expiry: dateOnly(90), malpractice_expiry: dateOnly(90),
      dea_expiry: null, caqh_last_attested: null,
      oig_excluded: false, oig_checked_at: null,
    },
    {
      id: p[6], first_name: "Grace", last_name: "Kim", credentials: "MD",
      provider_type: "psychiatrist", npi: "9000000007", email: `grace@${DEMO_DOMAIN}`,
      phone: "555-0107", license_state: "FL", status: "inactive", fill_rate: 0.0,
      contract_signed: false, stripe_onboarding_complete: false,
      license_expiry: dateOnly(60), malpractice_expiry: dateOnly(60),
      dea_expiry: null, caqh_last_attested: null,
      oig_excluded: false, oig_checked_at: null,
    },
  ];
  await insertAll("providers", providers);

  // Onboarding stages (for the pipeline Kanban) --------------------------
  await insertAll("provider_onboarding_status", [
    { provider_id: p[0], current_stage: 5, updated_at: daysFromNow(-2) },
    { provider_id: p[1], current_stage: 5, updated_at: daysFromNow(-3) },
    { provider_id: p[2], current_stage: 5, updated_at: daysFromNow(-1) },
    { provider_id: p[3], current_stage: 4, updated_at: daysFromNow(-2) },
    { provider_id: p[4], current_stage: 3, updated_at: daysFromNow(-1) },
    { provider_id: p[5], current_stage: 2, updated_at: daysFromNow(-12) }, // stuck
    { provider_id: p[6], current_stage: 1, updated_at: daysFromNow(-1) },
  ]);

  // Patients -------------------------------------------------------------
  const activeProvs = [p[0], p[1], p[2]];
  const payers = ["Aetna", "BCBS FL", "Cigna", "UnitedHealthcare", "Self-pay"];
  const careTypes = ["medication", "therapy", "medication_therapy"];
  const firstNames = ["John", "Aisha", "Robert", "Mia", "Carlos", "Nina", "Leo", "Sara", "Omar", "Eve"];
  const lastNames = ["Doe", "Patel", "Smith", "Lee", "Garcia", "Cohen", "Ford", "Ahmed", "Diaz", "Stone"];
  const pat = Array.from({ length: 10 }, () => randomUUID());
  const patients: Row[] = pat.map((id, i) => ({
    id,
    first_name: firstNames[i],
    last_name: lastNames[i],
    email: `${firstNames[i].toLowerCase()}.${lastNames[i].toLowerCase()}@${DEMO_DOMAIN}`,
    phone: `555-02${String(i).padStart(2, "0")}`,
    status: i === 9 ? "inactive" : "active",
    insurance_payer: payers[i % payers.length],
    care_type: careTypes[i % careTypes.length],
    primary_provider_id: activeProvs[i % activeProvs.length],
  }));
  await insertAll("patients", patients);

  // Appointments — today's monitor window + spread across the week --------
  // scheduled_at is NOT NULL on this DB; start_time is what the app reads.
  const appt = (r: Row & { start_time: string }): Row => ({
    scheduled_at: r.start_time,
    ...r,
  });
  const apptToday: Row[] = [
    appt({ patient_id: pat[0], provider_id: p[0], status: "scheduled", appointment_type: "follow_up", session_modality: "video", start_time: minsFromNow(40) }),
    appt({ patient_id: pat[1], provider_id: p[1], status: "scheduled", appointment_type: "follow_up", session_modality: "phone", start_time: minsFromNow(95) }),
    appt({ patient_id: pat[2], provider_id: p[2], status: "confirmed", appointment_type: "therapy", session_modality: "video", start_time: minsFromNow(150) }),
    appt({ patient_id: pat[3], provider_id: p[0], status: "scheduled", appointment_type: "follow_up", session_modality: "video", start_time: minsFromNow(-20), session_started_at: minsFromNow(-18) }),
    appt({ patient_id: pat[4], provider_id: p[1], status: "completed", appointment_type: "follow_up", session_modality: "video", start_time: minsFromNow(-45) }),
    appt({ patient_id: pat[5], provider_id: p[2], status: "no_show", appointment_type: "therapy", session_modality: "phone", start_time: minsFromNow(-15) }),
  ];
  const apptWeek: Row[] = Array.from({ length: 10 }, (_, i) =>
    appt({
      patient_id: pat[i % pat.length],
      provider_id: activeProvs[i % activeProvs.length],
      status: i % 3 === 0 ? "scheduled" : "completed",
      appointment_type: "follow_up",
      session_modality: i % 2 === 0 ? "video" : "phone",
      start_time: daysFromNow(-((i % 6) + 1) * 0.4),
    })
  );
  await insertAll("appointments", [...apptToday, ...apptWeek]);

  // Encounters this week (drives Revenue This Week) ----------------------
  const cpts = ["90834", "90837", "99214", "90791"];
  const icd10s = ["F41.1", "F32.1", "F90.0", "F43.23"];
  const encounters: Row[] = Array.from({ length: 12 }, (_, i) => ({
    patient_id: pat[i % pat.length],
    provider_id: activeProvs[i % activeProvs.length],
    date_of_service: dateOnly(-(i % 6)),
    charge_amount: 180 + (i % 4) * 40,
    paid_amount: 120 + (i % 4) * 30,
    cpt_code: cpts[i % cpts.length],
    icd10_primary: icd10s[i % icd10s.length],
    claim_status: i % 3 === 0 ? "pending" : "paid",
  }));
  await insertAll("encounters", encounters);

  // Provider payments (live feed + revenue) ------------------------------
  const payments: Row[] = [
    { provider_id: p[0], provider_amount: 1240.5, session_count: 14, status: "paid", transfer_status: "paid", transferred_at: daysFromNow(-1), created_at: minsFromNow(-30), celebration_shown: true },
    { provider_id: p[1], provider_amount: 2105.0, session_count: 9, status: "paid", transfer_status: "paid", transferred_at: daysFromNow(-1), created_at: minsFromNow(-180), celebration_shown: true },
    { provider_id: p[2], provider_amount: 880.75, session_count: 11, status: "pending", transfer_status: "pending", transferred_at: null, created_at: daysFromNow(-1), celebration_shown: true },
    { provider_id: p[0], provider_amount: 1530.25, session_count: 17, status: "paid", transfer_status: "paid", transferred_at: daysFromNow(-8), created_at: daysFromNow(-2), celebration_shown: true },
    { provider_id: p[1], provider_amount: 1975.0, session_count: 8, status: "paid", transfer_status: "paid", transferred_at: daysFromNow(-8), created_at: daysFromNow(-3), celebration_shown: true },
    { provider_id: p[2], provider_amount: 640.0, session_count: 7, status: "paid", transfer_status: "paid", transferred_at: daysFromNow(-8), created_at: daysFromNow(-4), celebration_shown: true },
  ];
  await insertAll("provider_payments", payments);

  // Insurance claims (billing center) ------------------------------------
  const claims: Row[] = [
    ...Array.from({ length: 4 }, (_, i) => ({
      patient_id: pat[i], provider_id: activeProvs[i % 3], payer_name: payers[i % 4],
      billed_amount: 200 + i * 25, paid_amount: 0,
      status: ["draft", "submitted", "accepted", "submitted"][i],
      submitted_at: daysFromNow(-(i + 2)),
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      patient_id: pat[i + 4], provider_id: activeProvs[i % 3], payer_name: payers[i % 4],
      billed_amount: 220 + i * 30, paid_amount: 150 + i * 20, status: "paid",
      submitted_at: daysFromNow(-(i + 12)), adjudicated_at: daysFromNow(-(i + 2)),
    })),
    ...Array.from({ length: 2 }, (_, i) => ({
      patient_id: pat[i + 8], provider_id: activeProvs[i % 3], payer_name: payers[i % 4],
      billed_amount: 190 + i * 20, paid_amount: 0, status: "denied",
      denial_reason: ["Missing prior auth", "Non-covered service"][i],
      submitted_at: daysFromNow(-(i + 6)), adjudicated_at: daysFromNow(-(i + 1)),
    })),
  ];
  await insertAll("insurance_claims", claims);

  // Provider absences (coverage) -----------------------------------------
  await insertAll("provider_absences", [
    { provider_id: p[0], absence_type: "same_day_sick", start_date: dateOnly(0), end_date: dateOnly(2), status: "active", affected_appointment_ids: [randomUUID(), randomUUID()], coverage_provider_ids: [p[1]] },
    { provider_id: p[1], absence_type: "planned_vacation", start_date: dateOnly(5), end_date: dateOnly(12), status: "active", affected_appointment_ids: [randomUUID(), randomUUID(), randomUUID()], coverage_provider_ids: [] },
    { provider_id: p[2], absence_type: "emergency", start_date: dateOnly(-1), end_date: dateOnly(1), status: "active", affected_appointment_ids: [randomUUID()], coverage_provider_ids: [p[0]] },
  ]);

  // Outreach contacts (scraper queue) ------------------------------------
  const cities: [string, string][] = [["Miami", "FL"], ["Tampa", "FL"], ["Atlanta", "GA"], ["Austin", "TX"], ["Orlando", "FL"], ["Savannah", "GA"]];
  const outreach: Row[] = Array.from({ length: 12 }, (_, i) => ({
    npi: `8${String(100000000 + i)}`,
    first_name: ["Dr. Alan", "Dr. Beth", "Dr. Cory", "Dr. Dana"][i % 4],
    last_name: ["Frey", "Glas", "Hunt", "Ives"][i % 4],
    practice_name: `${cities[i % cities.length][0]} Behavioral Health`,
    city: cities[i % cities.length][0],
    state: cities[i % cities.length][1],
    source: SEED_MARKER,
    outreach_type: ["referral_source", "provider_recruit", "both"][i % 3],
    contact_status: "not_contacted",
    tier: (i % 2) + 1,
  }));
  await insertAll("outreach_contacts", outreach);

  // Daily send log (campaign metrics) ------------------------------------
  const sendLog: Row[] = [
    ...Array.from({ length: 12 }, (_, i) => ({
      send_date: dateOnly(0), channel: "fax",
      campaign: i % 3 === 0 ? "provider_recruit" : "referral_outreach",
      status: "sent", external_id: `${SEED_MARKER}_today_${i}`,
    })),
    ...Array.from({ length: 18 }, (_, i) => ({
      send_date: dateOnly(-((i % 20) + 1)), channel: "fax",
      campaign: "referral_outreach", status: "sent",
      external_id: `${SEED_MARKER}_ref_${i}`,
    })),
    ...Array.from({ length: 9 }, (_, i) => ({
      send_date: dateOnly(-((i % 20) + 1)), channel: "fax",
      campaign: "provider_recruit", status: "sent",
      external_id: `${SEED_MARKER}_rec_${i}`,
    })),
  ];
  await insertAll("daily_send_log", sendLog);

  // Balance decisions ----------------------------------------------------
  await insertAll("balance_decisions", [
    { decision: "Shift to referral outreach", reasoning: "[demo] Fill rate above 80% — prioritize patient demand.", urgency: "low", created_at: minsFromNow(-60) },
    { decision: "Hold allocation", reasoning: "[demo] Metrics stable week over week.", urgency: "low", created_at: daysFromNow(-1) },
    { decision: "Increase recruiting", reasoning: "[demo] Two providers approaching capacity in FL.", urgency: "medium", created_at: daysFromNow(-2) },
    { decision: "Escalate recruiting", reasoning: "[demo] Wait time exceeded target in GA.", urgency: "high", created_at: daysFromNow(-3) },
    { decision: "Shift to referral outreach", reasoning: "[demo] New providers activated, capacity opened.", urgency: "low", created_at: daysFromNow(-4) },
  ]);

  // Audit log ------------------------------------------------------------
  const actions = ["create", "update", "view", "login", "export"];
  await insertAll(
    "audit_log",
    Array.from({ length: 8 }, (_, i) => ({
      action: actions[i % actions.length],
      actor_email: ADMIN_EMAIL,
      entity_type: ["provider", "patient", "claim", "payment"][i % 4],
      changes: { note: "demo audit entry" },
      created_at: minsFromNow(-i * 45),
    }))
  );
}

async function main() {
  console.log("\n=== PsychRx admin demo seed ===\n");
  console.log(`  DB: ${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/https?:\/\//, "")}`);

  if (!process.env.SUPABASE_SERVICE_KEY) {
    console.error("  Missing SUPABASE_SERVICE_KEY in env. Aborting.");
    process.exit(1);
  }

  await cleanup();
  await ensureAdminUser();
  await seed();

  console.log("\n  Done. Log in at /auth/login then open /admin/dashboard.\n");
  process.exit(0);
}

void main();
