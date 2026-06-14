/**
 * PsychRx Workers — main entry point
 * ----------------------------------
 * Starts all 11 background workers on their schedules:
 *
 *   matching-worker    every 60 seconds
 *   reminder-worker    every 15 minutes
 *   sms-router         every 10 seconds
 *   balance-engine     every 4 hours
 *   state-expansion    Mondays 9:00am
 *   compliance-worker  daily 6:00am
 *   slot-generator     daily midnight
 *   payment-worker     Sundays 6:00pm EST
 *   coverage-worker    every 2 hours
 *   campaign-worker    daily 9:00am
 *
 * Run with: tsx --env-file=.env.local workers/index.ts
 * Stops all cron schedules gracefully on SIGTERM/SIGINT.
 */
import cron from "node-cron";
import { startMatchingWorker } from "@/workers/matching-worker";
import { startReminderWorker } from "@/workers/reminder-worker";
import { startSmsRouter } from "@/workers/sms-router";
import { startBalanceEngine } from "@/workers/balance-engine";
import { startStateExpansionWorker } from "@/workers/state-expansion";
import { startComplianceWorker } from "@/workers/compliance-worker";
import { startSlotGenerator } from "@/workers/slot-generator";
import { startPaymentWorker } from "@/workers/payment-worker";
import { startCoverageWorker } from "@/workers/coverage-worker";
import { startCampaignWorker } from "@/workers/campaign-worker";

const WORKERS: Array<{ name: string; start: () => void }> = [
  { name: "matching-worker", start: startMatchingWorker },
  { name: "reminder-worker", start: startReminderWorker },
  { name: "sms-router", start: startSmsRouter },
  { name: "balance-engine", start: startBalanceEngine },
  { name: "state-expansion", start: startStateExpansionWorker },
  { name: "compliance-worker", start: startComplianceWorker },
  { name: "slot-generator", start: startSlotGenerator },
  { name: "payment-worker", start: startPaymentWorker },
  { name: "coverage-worker", start: startCoverageWorker },
  { name: "campaign-worker", start: startCampaignWorker },
];

function startAll(): void {
  console.log(`[workers] starting ${WORKERS.length} PsychRx background workers...`);
  for (const worker of WORKERS) {
    try {
      worker.start();
      console.log(`[workers] started ${worker.name}`);
    } catch (err) {
      // One broken worker must not prevent the rest from starting.
      console.error(`[workers] FAILED to start ${worker.name}:`, err);
    }
  }
  console.log("[workers] all workers started. Press Ctrl+C to stop.");
}

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[workers] received ${signal} — stopping all schedules...`);
  cron.getTasks().forEach((task, name) => {
    try {
      task.stop();
      console.log(`[workers] stopped schedule ${name}`);
    } catch (err) {
      console.error(`[workers] error stopping schedule ${name}:`, err);
    }
  });
  console.log("[workers] graceful shutdown complete.");
  // Give in-flight DB/SMS calls a moment to settle before exiting.
  setTimeout(() => process.exit(0), 2_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Workers must never crash the process; log and keep running.
process.on("unhandledRejection", (reason) => {
  console.error("[workers] unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[workers] uncaught exception:", err);
});

startAll();
