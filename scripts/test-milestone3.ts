/**
 * Milestone 3 — structured one-shot test for all background workers.
 * Run: npx tsx --env-file=.env.local scripts/test-milestone3.ts
 *
 * Safe: no Stripe transfers / faxes / SMS unless the worker finds real work
 * (e.g. pending encounters, expiring licenses, outreach contacts).
 */
import { supabaseAdmin } from "@/lib/supabase";
import { runMatchingOnce } from "@/workers/matching-worker";
import { runReminderWorkerOnce } from "@/workers/reminder-worker";
import { runSmsRouterOnce } from "@/workers/sms-router";
import { runBalanceEngineOnce } from "@/workers/balance-engine";
import { runStateExpansionOnce } from "@/workers/state-expansion";
import { runComplianceWorkerOnce } from "@/workers/compliance-worker";
import { runSlotGeneratorOnce } from "@/workers/slot-generator";
import { runPaymentWorkerOnce } from "@/workers/payment-worker";
import { runCoverageWorkerOnce } from "@/workers/coverage-worker";
import { runCampaignWorkerOnce } from "@/workers/campaign-worker";
import { runNoShowWorkerOnce } from "@/workers/noshow-worker";

type Status = "PASS" | "FAIL" | "WARN";

interface CheckResult {
  name: string;
  status: Status;
  detail: string;
  ms: number;
}

async function count(table: string, filter?: (q: ReturnType<typeof supabaseAdmin.from>) => ReturnType<typeof supabaseAdmin.from>): Promise<number | null> {
  let q = supabaseAdmin.from(table).select("id", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count, error } = await q;
  if (error) return null;
  return count ?? 0;
}

async function preflight(): Promise<void> {
  console.log("\n=== MILESTONE 3 PREFLIGHT (database) ===\n");
  const rows: Array<[string, number | string]> = [
    ["providers (active)", await count("providers", (q) => q.eq("status", "active")) ?? "query failed"],
    ["patients", await count("patients") ?? "query failed"],
    ["waitlist (waiting)", await count("waitlist", (q) => q.eq("status", "waiting")) ?? "query failed"],
    ["waitlist (offered)", await count("waitlist", (q) => q.eq("status", "offered")) ?? "query failed"],
    ["provider_slots (open)", await count("provider_slots", (q) => q.eq("status", "open")) ?? "query failed"],
    ["appointments (scheduled+)", await count("appointments", (q) => q.in("status", ["scheduled", "confirmed", "rescheduled"])) ?? "query failed"],
    ["encounters (payout pending)", await count("encounters", (q) => q.eq("provider_payout_status", "pending")) ?? "query failed"],
    ["sms_commands (unprocessed)", await count("sms_commands", (q) => q.eq("processed", false)) ?? "query failed"],
    ["provider_absences (active sick)", await count("provider_absences", (q) => q.eq("status", "active").eq("absence_type", "sick")) ?? "query failed"],
    ["worker_logs (last 24h)", await count("worker_logs", (q) => q.gte("started_at", new Date(Date.now() - 86_400_000).toISOString())) ?? "query failed"],
  ];
  for (const [label, value] of rows) {
    console.log(`  ${label.padEnd(32)} ${value}`);
  }
}

async function runCheck(
  name: string,
  fn: () => Promise<string>,
  warnIf?: (detail: string) => boolean
): Promise<CheckResult> {
  const start = Date.now();
  try {
    const detail = await fn();
    const ms = Date.now() - start;
    const status: Status = warnIf?.(detail) ? "WARN" : "PASS";
    return { name, status, detail, ms };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { name, status: "FAIL", detail: msg, ms: Date.now() - start };
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  PsychRx Milestone 3 — Background Worker Test Suite     ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log(`  DB:   ${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/https?:\/\//, "")}`);

  await preflight();

  console.log("\n=== WORKER ONE-SHOT RUNS ===\n");

  const checks: CheckResult[] = [];

  checks.push(
    await runCheck("1. matching-worker (60s)", async () => {
      const offered = await runMatchingOnce();
      return `offered=${offered}`;
    })
  );

  checks.push(
    await runCheck("2. reminder-worker (15min)", async () => {
      const tiers = await runReminderWorkerOnce();
      return tiers.map((t) => `${t.label}: sent=${t.sent} errors=${t.errors}`).join("; ");
    }, (d) => d.includes("errors=1") || d.includes("query error"))
  );

  checks.push(
    await runCheck("3. sms-router (10s)", async () => {
      const n = await runSmsRouterOnce();
      return `processed=${n} command(s)`;
    })
  );

  checks.push(
    await runCheck("4. balance-engine (4h)", async () => {
      await runBalanceEngineOnce();
      return "metrics snapshot written";
    })
  );

  checks.push(
    await runCheck("5. state-expansion (Mon 9am)", async () => {
      const recommended = await runStateExpansionOnce();
      return recommended ? "expansion recommended to owner" : "thresholds not met (expected in dev)";
    })
  );

  checks.push(
    await runCheck("6. compliance-worker (daily 6am)", async () => {
      const actions = await runComplianceWorkerOnce();
      return `warnings+suspensions=${actions}`;
    }, (d) => d.includes("suspensions=") && !d.endsWith("=0"))
  );

  checks.push(
    await runCheck("7. slot-generator (midnight)", async () => {
      const created = await runSlotGeneratorOnce();
      return `created=${created} slot(s)`;
    })
  );

  checks.push(
    await runCheck("8. payment-worker (Sun 6pm)", async () => {
      const paid = await runPaymentWorkerOnce();
      return `providers paid=${paid}`;
    })
  );

  checks.push(
    await runCheck("9. coverage-worker (2h)", async () => {
      const handled = await runCoverageWorkerOnce();
      return `appointments handled=${handled}`;
    })
  );

  checks.push(
    await runCheck("10. campaign-worker (daily 9am)", async () => {
      const sent = await runCampaignWorkerOnce();
      return `faxes sent=${sent}`;
    })
  );

  checks.push(
    await runCheck("11. noshow-worker (15min, bonus)", async () => {
      const n = await runNoShowWorkerOnce();
      return `no-shows processed=${n}`;
    })
  );

  // Summary table
  console.log("\n=== RESULTS ===\n");
  const col = (s: string, w: number) => s.padEnd(w);
  console.log(`${col("Worker", 40)} ${col("Status", 8)} ${col("Time", 8)} Detail`);
  console.log("-".repeat(100));
  for (const c of checks) {
    const icon = c.status === "PASS" ? "✓" : c.status === "WARN" ? "!" : "✗";
    console.log(`${col(c.name, 40)} ${col(`${icon} ${c.status}`, 8)} ${col(`${c.ms}ms`, 8)} ${c.detail}`);
  }

  const failed = checks.filter((c) => c.status === "FAIL");
  const warned = checks.filter((c) => c.status === "WARN");
  const passed = checks.filter((c) => c.status === "PASS");

  console.log("\n=== SUMMARY ===");
  console.log(`  PASS: ${passed.length}  WARN: ${warned.length}  FAIL: ${failed.length}  TOTAL: ${checks.length}`);

  if (failed.length) {
    console.log("\n  FAILED:");
    for (const f of failed) console.log(`    - ${f.name}: ${f.detail}`);
    process.exit(1);
  }

  console.log("\n  All workers executed without errors.");
  console.log("  Next: run `npm run workers` to start the 24/7 bundle.");
  process.exit(0);
}

void main();
