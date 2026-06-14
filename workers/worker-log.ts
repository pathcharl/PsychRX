/**
 * Shared helper for the `worker_logs` table (database/core_spec.sql).
 * Every worker run is wrapped in `withWorkerLog`, which records one row per
 * run (started_at/completed_at, status, message, records_processed,
 * error_details) and NEVER throws — a worker must not crash on a logging or
 * runtime error.
 */
import { supabaseAdmin } from "@/lib/supabase";

export interface WorkerRunResult {
  /** Human-readable summary of what the run did (stored in `message`). */
  message?: string;
  /** Number of records the run touched (stored in `records_processed`). */
  records?: number;
}

/**
 * Run `fn` and write a single `worker_logs` row describing the outcome.
 * Errors thrown by `fn` are caught, logged, and swallowed so cron schedules
 * keep ticking.
 */
export async function withWorkerLog(
  workerName: string,
  fn: () => Promise<WorkerRunResult | void>
): Promise<WorkerRunResult | null> {
  const startedAt = new Date().toISOString();
  try {
    const result = (await fn()) ?? {};
    await insertLog({
      worker_name: workerName,
      status: "completed",
      message: result.message ?? null,
      records_processed: result.records ?? 0,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    });
    if (result.message) console.log(`[${workerName}] ${result.message}`);
    return result;
  } catch (err) {
    console.error(`[${workerName}] run failed:`, err);
    await insertLog({
      worker_name: workerName,
      status: "failed",
      message: "run failed",
      error_details: err instanceof Error ? (err.stack ?? err.message) : String(err),
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    });
    return null;
  }
}

async function insertLog(row: Record<string, unknown>): Promise<void> {
  try {
    await supabaseAdmin.from("worker_logs").insert(row);
  } catch (err) {
    // Logging must never take a worker down.
    console.error("[worker-log] failed to write worker_logs row:", err);
  }
}
