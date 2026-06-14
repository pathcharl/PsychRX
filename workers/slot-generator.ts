/**
 * PsychRx Slot Generator Worker
 * -----------------------------
 * Runs daily at midnight (office timezone). For each active provider it reads
 * their availability_templates and generates open slots for the next 30 days,
 * respecting blocked_dates and skipping slots that already exist
 * (see lib/slots.ts). Each run is recorded in worker_logs.
 */
import cron from "node-cron";
import { generateAllProviderSlots, officeToday } from "@/lib/slots";
import { withWorkerLog } from "@/workers/worker-log";

const WORKER_NAME = "slot-generator";
const OFFICE_TIMEZONE = process.env.OFFICE_TIMEZONE ?? "America/New_York";
const HORIZON_DAYS = Number(process.env.SLOT_HORIZON_DAYS ?? 30);

/** Run one slot-generation pass. Returns total new slots created. */
export async function runSlotGeneratorOnce(): Promise<number> {
  let total = 0;

  await withWorkerLog(WORKER_NAME, async () => {
    console.log(
      `[${WORKER_NAME}] starting pass — horizon=${HORIZON_DAYS} days, ` +
        `office today=${officeToday()}, tz=${OFFICE_TIMEZONE}`
    );
    total = await generateAllProviderSlots(HORIZON_DAYS);
    return {
      records: total,
      message: `created ${total} slot(s) for the next ${HORIZON_DAYS} days`,
    };
  });

  return total;
}

/** Schedule daily slot generation at midnight office time. */
export function startSlotGenerator(): void {
  console.log(`[${WORKER_NAME}] scheduled daily at 00:00 (${OFFICE_TIMEZONE})`);
  cron.schedule("0 0 * * *", () => void runSlotGeneratorOnce(), {
    timezone: OFFICE_TIMEZONE,
  });
}

// Run directly: schedule, or `RUN_ONCE=1 tsx workers/slot-generator.ts` for one pass.
if (require.main === module) {
  if (process.env.RUN_ONCE) {
    void runSlotGeneratorOnce().then(() => process.exit(0));
  } else {
    startSlotGenerator();
  }
}
