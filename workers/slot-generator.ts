/**
 * PsychRx Slot Generator Worker
 * -----------------------------
 * Runs daily at midnight (office timezone) and generates open provider_slots
 * for the next 30 days from availability_templates, respecting blocked_dates
 * and skipping slots that already exist.
 */
import cron from "node-cron";
import { supabaseAdmin } from "@/lib/supabase";
import { generateAllProviderSlots } from "@/lib/slots";

const OFFICE_TIMEZONE = process.env.OFFICE_TIMEZONE ?? "America/New_York";
const HORIZON_DAYS = Number(process.env.SLOT_HORIZON_DAYS ?? 30);

/** Run one slot-generation pass. Returns total new slots created. */
export async function runSlotGeneratorOnce(): Promise<number> {
  const startedAt = Date.now();

  const { data: logRow } = await supabaseAdmin
    .from("workers_log")
    .insert({ worker_name: "slot-generator", job_type: "daily_slots", status: "running" })
    .select("id")
    .maybeSingle();
  const logId = (logRow as { id: string } | null)?.id ?? null;

  let total = 0;
  try {
    total = await generateAllProviderSlots(HORIZON_DAYS);

    if (logId) {
      await supabaseAdmin
        .from("workers_log")
        .update({
          status: "completed",
          records_processed: total,
          duration_ms: Date.now() - startedAt,
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }
    console.log(`[slot-generator] created ${total} slot(s) for next ${HORIZON_DAYS} days.`);
  } catch (err) {
    if (logId) {
      await supabaseAdmin
        .from("workers_log")
        .update({
          status: "failed",
          duration_ms: Date.now() - startedAt,
          finished_at: new Date().toISOString(),
          error_message: err instanceof Error ? err.message : String(err),
        })
        .eq("id", logId);
    }
    console.error("[slot-generator] run failed:", err);
  }

  return total;
}

/** Schedule daily slot generation at midnight office time. */
export function startSlotGeneratorCron(): void {
  console.log(`[slot-generator] scheduled daily at 00:00 (${OFFICE_TIMEZONE})`);
  cron.schedule("0 0 * * *", () => void runSlotGeneratorOnce(), {
    timezone: OFFICE_TIMEZONE,
  });
}

if (require.main === module) {
  if (process.env.RUN_ONCE) {
    void runSlotGeneratorOnce().then(() => process.exit(0));
  } else {
    startSlotGeneratorCron();
  }
}
