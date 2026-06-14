/**
 * One-shot smoke test for the side-effect-light workers.
 * Run: npx tsx --env-file=.env.local scripts/test-workers-once.ts
 */
import { runMatchingOnce } from "@/workers/matching-worker";
import { runReminderWorkerOnce } from "@/workers/reminder-worker";
import { runBalanceEngineOnce } from "@/workers/balance-engine";
import { runCoverageWorkerOnce } from "@/workers/coverage-worker";
import { runSmsRouterOnce } from "@/workers/sms-router";

async function main() {
  console.log("=== matching-worker ===");
  await runMatchingOnce();
  console.log("=== reminder-worker ===");
  await runReminderWorkerOnce();
  console.log("=== balance-engine ===");
  await runBalanceEngineOnce();
  console.log("=== coverage-worker ===");
  await runCoverageWorkerOnce();
  console.log("=== sms-router ===");
  await runSmsRouterOnce();
  console.log("=== done ===");
  process.exit(0);
}

void main();
