/**
 * End-to-end flow test: Patient -> Provider -> Admin.
 * Run: npx tsx --env-file=.env.local scripts/test-e2e-flow.ts
 *
 * Creates FRESH test accounts, drives each portal's real data/logic layer
 * (the same functions the UI calls), verifies every step, then deletes all
 * test data. No real SMS/email is sent (activation senders are intentionally
 * not invoked; we replicate only the auth-link step).
 */
import "./_cache-shim";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";
import { createPatientRecord } from "@/lib/intake";
import { confirmBooking } from "@/lib/matching";
import { patchAppointment, setAppointmentTime } from "@/lib/appointments";
import { getPortalPatient } from "@/lib/patient-portal/auth";
import { getPortalProvider } from "@/lib/portal/auth";
import {
  fetchDashboardData as fetchPatientDashboard,
  fetchAppointmentsData,
  resolveMessagingProviderId,
} from "@/lib/patient-portal/data";
import {
  fetchDashboardData as fetchProviderDashboard,
  fetchScheduleAppointments,
} from "@/lib/portal/data";
import type { PortalProvider } from "@/lib/portal/types";
import {
  fetchAdminDashboard,
  fetchAdminProviders,
  fetchAdminPatients,
} from "@/lib/admin/data";
import { SESSION_TYPES } from "@/lib/constants";

type Status = "PASS" | "FAIL" | "WARN";
interface Result {
  step: string;
  status: Status;
  detail: string;
}

const results: Result[] = [];
function record(step: string, status: Status, detail: string) {
  results.push({ step, status, detail });
  const icon = status === "PASS" ? "✓" : status === "WARN" ? "!" : "✗";
  console.log(`  ${icon} [${status}] ${step} — ${detail}`);
}

async function check(step: string, fn: () => Promise<string>) {
  try {
    const detail = await fn();
    record(step, "PASS", detail);
    return true;
  } catch (err) {
    record(step, "FAIL", err instanceof Error ? err.message : String(err));
    return false;
  }
}

const tag = Date.now();
const ids = {
  providerId: "",
  patientId: "",
  apptInitial: "",
  apptPortal: "",
  patientUserId: "",
  providerUserId: "",
  slotA: "",
  slotB: "",
};

const patientEmail = `e2e-patient-${tag}@psychrx-test.local`;
const providerEmail = `e2e-provider-${tag}@psychrx-test.local`;
const patientPhone = `+1555${String(tag).slice(-7)}`;
const providerPhone = `+1556${String(tag).slice(-7)}`;

function isoIn(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

async function setup() {
  console.log("\n=== SETUP (fresh test accounts) ===\n");

  // Provider record (active, accepting patients).
  const { data: provider, error: provErr } = await supabaseAdmin
    .from("providers")
    .insert({
      first_name: "E2E",
      last_name: `Provider${tag}`,
      email: providerEmail,
      phone: providerPhone,
      npi: String(tag).slice(-10).padStart(10, "0"),
      license_state: "FL",
      status: "active",
      accepts_new_patients: true,
      provider_type: "pmhnp",
      credentials: "PMHNP-BC",
      telehealth_link: "https://doxy.me/e2e-test",
    })
    .select("id")
    .single();
  if (provErr || !provider) {
    throw new Error(`provider insert failed: ${provErr?.message}`);
  }
  ids.providerId = provider.id as string;

  // Two open slots: slotA tomorrow (initial booking), slotB later today (in-portal).
  const { data: slots, error: slotErr } = await supabaseAdmin
    .from("provider_slots")
    .insert([
      {
        provider_id: ids.providerId,
        start_time: isoIn(24),
        end_time: isoIn(24.5),
        status: "open",
      },
      {
        provider_id: ids.providerId,
        start_time: isoIn(3),
        end_time: isoIn(3.5),
        status: "open",
      },
    ])
    .select("id, start_time")
    .order("start_time", { ascending: false });
  if (slotErr || !slots || slots.length < 2) {
    throw new Error(`slot insert failed: ${slotErr?.message}`);
  }
  // order desc => [tomorrow, today]
  ids.slotA = slots[0].id as string;
  ids.slotB = slots[1].id as string;

  console.log(
    `  provider=${ids.providerId} slotA(tomorrow)=${ids.slotA} slotB(today)=${ids.slotB}`
  );
}

async function patientFlow() {
  console.log("\n=== PATIENT FLOW ===\n");

  await check("1. Booking: create patient record", async () => {
    const patient = await createPatientRecord({
      channel: "portal",
      first_name: "E2E",
      last_name: `Patient${tag}`,
      dob: "1990-01-01",
      phone: patientPhone,
      email: patientEmail,
      insurance: "Aetna",
      care_type: "medication_management",
      raw: { state: "FL", emergency_contact: "Kin 555-0000" },
    });
    ids.patientId = patient.id;
    return `patient=${patient.id}`;
  });

  await check("2. Booking: confirm slot + create appointment", async () => {
    await supabaseAdmin
      .from("patients")
      .update({ primary_provider_id: ids.providerId, status: "active" })
      .eq("id", ids.patientId);

    const booked = await confirmBooking(ids.slotA, ids.patientId, ids.providerId);
    if (!booked) throw new Error("confirmBooking returned null");
    ids.apptInitial = booked.appointmentId;

    const meta = SESSION_TYPES.find((s) => s.value === "medication_management");
    await patchAppointment(booked.appointmentId, {
      appointment_type: "medication_management",
      duration_minutes: meta?.defaultDurationMinutes,
    });
    await setAppointmentTime(booked.appointmentId, isoIn(24));

    const { data: slot } = await supabaseAdmin
      .from("provider_slots")
      .select("status")
      .eq("id", ids.slotA)
      .single();
    if (slot?.status !== "booked") throw new Error(`slot status=${slot?.status}`);
    return `appt=${booked.appointmentId} slot=booked`;
  });

  await check("3. Activation: create auth user + link patient", async () => {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: patientEmail,
      password: `Pw!${tag}aA`,
      email_confirm: true,
      app_metadata: { role: "patient" },
      user_metadata: { full_name: `E2E Patient${tag}` },
    });
    if (error || !created.user) throw new Error(error?.message ?? "no user");
    ids.patientUserId = created.user.id;
    await supabaseAdmin
      .from("patients")
      .update({ user_id: created.user.id })
      .eq("id", ids.patientId);
    return `user=${created.user.id}`;
  });

  let portalPatient: Awaited<ReturnType<typeof getPortalPatient>> = null;

  await check("4. Portal resolves the booked patient (not a dupe)", async () => {
    const user = {
      id: ids.patientUserId,
      email: patientEmail,
      app_metadata: { role: "patient" },
      user_metadata: {},
    } as unknown as User;
    portalPatient = await getPortalPatient(user);
    if (!portalPatient) throw new Error("getPortalPatient returned null");
    if (portalPatient.id !== ids.patientId) {
      throw new Error(
        `resolved wrong patient ${portalPatient.id} != ${ids.patientId}`
      );
    }
    return `resolved patient=${portalPatient.id}`;
  });

  await check("5. Patient dashboard shows the appointment", async () => {
    if (!portalPatient) throw new Error("no patient context");
    const dash = await fetchPatientDashboard(portalPatient);
    if (!dash.nextAppointment) throw new Error("nextAppointment is null");
    if (dash.nextAppointment.provider_id !== ids.providerId) {
      throw new Error("appointment provider mismatch");
    }
    return `nextAppt=${dash.nextAppointment.id} provider=${dash.nextAppointment.provider?.first_name ?? "?"}`;
  });

  await check("6. Patient appointments page lists upcoming", async () => {
    if (!portalPatient) throw new Error("no patient context");
    const data = await fetchAppointmentsData(portalPatient);
    const found = data.upcoming.some((a) => a.id === ids.apptInitial);
    if (!found) throw new Error(`upcoming did not include ${ids.apptInitial}`);
    return `upcoming=${data.upcoming.length}`;
  });

  await check("7. Messaging resolves the linked provider", async () => {
    if (!portalPatient) throw new Error("no patient context");
    const provId = await resolveMessagingProviderId(portalPatient);
    if (provId !== ids.providerId) {
      throw new Error(`messaging provider ${provId} != ${ids.providerId}`);
    }
    return `provider=${provId}`;
  });

  await check("8. In-portal scheduling books second appointment", async () => {
    if (!portalPatient) throw new Error("no patient context");
    const booked = await confirmBooking(ids.slotB, portalPatient.id, ids.providerId);
    if (!booked) throw new Error("in-portal confirmBooking returned null");
    ids.apptPortal = booked.appointmentId;
    await setAppointmentTime(booked.appointmentId, isoIn(3));
    return `appt=${booked.appointmentId}`;
  });
}

async function providerFlow() {
  console.log("\n=== PROVIDER FLOW ===\n");

  await check("9. Activation: create provider auth user + link", async () => {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: providerEmail,
      password: `Pw!${tag}bB`,
      email_confirm: true,
      app_metadata: { role: "provider" },
      user_metadata: { full_name: `E2E Provider${tag}` },
    });
    if (error || !created.user) throw new Error(error?.message ?? "no user");
    ids.providerUserId = created.user.id;
    await supabaseAdmin
      .from("providers")
      .update({ user_id: created.user.id })
      .eq("id", ids.providerId);
    return `user=${created.user.id}`;
  });

  await check("10. getPortalProvider resolves the right provider", async () => {
    const user = {
      id: ids.providerUserId,
      email: providerEmail,
      app_metadata: { role: "provider" },
      user_metadata: {},
    } as unknown as User;
    const provider = await getPortalProvider(user);
    if (!provider) throw new Error("getPortalProvider returned null");
    if (provider.id !== ids.providerId) throw new Error("resolved wrong provider");
    if (provider.status !== "active") throw new Error(`status=${provider.status}`);
    return `provider=${provider.id} status=active`;
  });

  await check("11. Provider Schedule lists the booked appointments", async () => {
    const sched = await fetchScheduleAppointments(ids.providerId);
    const found = sched.some(
      (a) => a.id === ids.apptInitial || a.id === ids.apptPortal
    );
    if (!found) throw new Error("schedule missing booked appointments");
    return `schedule rows=${sched.length}`;
  });

  await check("12. Provider dashboard renders (today sessions)", async () => {
    const provider = {
      id: ids.providerId,
      telehealth_link: "https://doxy.me/e2e-test",
      fill_rate: 0,
    } as unknown as PortalProvider;
    const dash = await fetchProviderDashboard(provider);
    // slotB (today) booking should appear as a today session.
    const today = dash.todaySessions.some((s) => s.id === ids.apptPortal);
    return `todaySessions=${dash.todaySessions.length} includesPortalBooking=${today}`;
  });
}

async function adminFlow() {
  console.log("\n=== ADMIN FLOW ===\n");

  await check("13. Admin dashboard aggregates", async () => {
    const dash = await fetchAdminDashboard();
    return `keys=${Object.keys(dash).join(",")}`;
  });

  await check("14. Admin providers includes test provider", async () => {
    const rows = await fetchAdminProviders();
    const found = rows.some((r) => (r as { id?: string }).id === ids.providerId);
    if (!found) throw new Error("test provider not in admin list");
    return `providers=${rows.length}`;
  });

  await check("15. Admin patients includes test patient", async () => {
    const rows = await fetchAdminPatients();
    const found = rows.some((r) => (r as { id?: string }).id === ids.patientId);
    if (!found) throw new Error("test patient not in admin list");
    return `patients=${rows.length}`;
  });
}

async function cleanup() {
  console.log("\n=== CLEANUP ===\n");
  try {
    await supabaseAdmin.from("provider_slots").delete().eq("provider_id", ids.providerId);
    if (ids.patientId) {
      await supabaseAdmin.from("appointments").delete().eq("patient_id", ids.patientId);
      await supabaseAdmin.from("patients").delete().eq("id", ids.patientId);
    }
    if (ids.providerId) {
      await supabaseAdmin.from("providers").delete().eq("id", ids.providerId);
    }
    if (ids.patientUserId) {
      await supabaseAdmin.auth.admin.deleteUser(ids.patientUserId);
    }
    if (ids.providerUserId) {
      await supabaseAdmin.auth.admin.deleteUser(ids.providerUserId);
    }
    console.log("  cleanup complete");
  } catch (err) {
    console.error("  cleanup error:", err);
  }
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  PsychRx E2E Flow — Patient / Provider / Admin         ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log(`  DB:   ${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/https?:\/\//, "")}`);

  try {
    await setup();
    await patientFlow();
    await providerFlow();
    await adminFlow();
  } catch (err) {
    record("SETUP", "FAIL", err instanceof Error ? err.message : String(err));
  } finally {
    await cleanup();
  }

  console.log("\n=== SUMMARY ===");
  const pass = results.filter((r) => r.status === "PASS").length;
  const warn = results.filter((r) => r.status === "WARN").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  console.log(`  PASS: ${pass}  WARN: ${warn}  FAIL: ${fail}  TOTAL: ${results.length}`);
  if (fail) {
    console.log("\n  FAILED:");
    for (const r of results.filter((x) => x.status === "FAIL")) {
      console.log(`    - ${r.step}: ${r.detail}`);
    }
  }
  process.exit(fail ? 1 : 0);
}

void main();
