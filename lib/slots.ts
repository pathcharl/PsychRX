// ============================================================================
// Slot generation from availability_templates → provider_slots (available slots).
// Respects blocked_dates and skips slots that already exist.
// ============================================================================
import { addDays, format, parseISO } from "date-fns";
import { supabaseAdmin } from "@/lib/supabase";

const OFFICE_TIMEZONE = process.env.OFFICE_TIMEZONE ?? "America/New_York";
const DEFAULT_HORIZON_DAYS = Number(process.env.SLOT_HORIZON_DAYS ?? 30);
const LOG_PREFIX = "[slots]";

interface TemplateRow {
  id: string;
  provider_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  appointment_type: string;
  is_active: boolean;
}

const WEEKDAY_TO_NUM: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Today's date (YYYY-MM-DD) in the office timezone. */
export function officeToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: OFFICE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Build [start, start+days] as YYYY-MM-DD strings in office-local calendar days. */
export function buildOfficeDateRange(days: number): string[] {
  const start = parseISO(officeToday());
  const dates: string[] = [];
  for (let i = 0; i <= days; i++) {
    dates.push(format(addDays(start, i), "yyyy-MM-dd"));
  }
  return dates;
}

/** Parse "HH:mm:ss" or "HH:mm" into minutes since midnight. */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** UTC offset in ms for a timezone at a given instant. */
function timezoneOffsetMs(at: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second")
  );
  return asUtc - at.getTime();
}

/** Build a UTC ISO timestamp from a local date + wall-clock time in OFFICE_TIMEZONE. */
function localSlotIso(dateStr: string, timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const noon = new Date(`${dateStr}T12:00:00Z`);
  const offset = timezoneOffsetMs(noon, OFFICE_TIMEZONE);
  const midnightUtc = Date.parse(`${dateStr}T00:00:00Z`);
  return new Date(midnightUtc + offset + (h * 3600 + m * 60) * 1000).toISOString();
}

/** Day-of-week (0 = Sunday) for a YYYY-MM-DD date in OFFICE_TIMEZONE. */
function dow(dateStr: string): number {
  const noonIso = localSlotIso(dateStr, "12:00:00");
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: OFFICE_TIMEZONE,
    weekday: "short",
  }).format(new Date(noonIso));
  return WEEKDAY_TO_NUM[weekday] ?? 0;
}

/**
 * Generate open provider_slots for one provider over the next `days` days.
 * Returns the number of new slots inserted.
 */
export async function generateSlotsForProvider(
  providerId: string,
  days: number = DEFAULT_HORIZON_DAYS
): Promise<number> {
  const { data: templates, error: templateError } = await supabaseAdmin
    .from("availability_templates")
    .select("*")
    .eq("provider_id", providerId)
    .eq("is_active", true);

  if (templateError) {
    console.error(
      `${LOG_PREFIX} template query failed for provider ${providerId}:`,
      templateError.message
    );
    return 0;
  }

  console.log(
    `${LOG_PREFIX} provider ${providerId}: ${templates?.length ?? 0} active template(s)`
  );

  if (!templates?.length) return 0;

  const dateRange = buildOfficeDateRange(days);
  console.log(
    `${LOG_PREFIX} provider ${providerId}: generating for ${dateRange.length} day(s) ` +
      `(${dateRange[0]} → ${dateRange[dateRange.length - 1]}, tz=${OFFICE_TIMEZONE})`
  );

  const { data: blocked, error: blockedError } = await supabaseAdmin
    .from("blocked_dates")
    .select("blocked_date")
    .eq("provider_id", providerId)
    .gte("blocked_date", dateRange[0])
    .lte("blocked_date", dateRange[dateRange.length - 1]);

  if (blockedError) {
    console.error(
      `${LOG_PREFIX} blocked_dates query failed for provider ${providerId}:`,
      blockedError.message
    );
  }

  const blockedSet = new Set(
    (blocked ?? []).map((b: { blocked_date: string }) => b.blocked_date)
  );
  if (blockedSet.size) {
    console.log(
      `${LOG_PREFIX} provider ${providerId}: ${blockedSet.size} blocked date(s) in range`
    );
  }

  const rangeStart = localSlotIso(dateRange[0], "00:00:00");
  const rangeEnd = localSlotIso(dateRange[dateRange.length - 1], "23:59:59");

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("provider_slots")
    .select("start_time")
    .eq("provider_id", providerId)
    .gte("start_time", rangeStart)
    .lte("start_time", rangeEnd);

  if (existingError) {
    console.error(
      `${LOG_PREFIX} existing slots query failed for provider ${providerId}:`,
      existingError.message
    );
  }

  const existingSet = new Set(
    (existing ?? []).map((s: { start_time: string }) => s.start_time)
  );
  console.log(
    `${LOG_PREFIX} provider ${providerId}: ${existingSet.size} existing slot(s) in range`
  );

  const rows: Array<{
    provider_id: string;
    start_time: string;
    end_time: string;
    status: string;
    source_template_id: string;
  }> = [];

  let skippedBlocked = 0;
  let skippedDow = 0;
  let skippedExisting = 0;
  let matchedTemplateDays = 0;

  for (const dateStr of dateRange) {
    if (blockedSet.has(dateStr)) {
      skippedBlocked += 1;
      continue;
    }
    const day = dow(dateStr);

    for (const tmpl of templates as TemplateRow[]) {
      if (tmpl.day_of_week !== day) {
        skippedDow += 1;
        continue;
      }
      matchedTemplateDays += 1;

      const startMin = timeToMinutes(tmpl.start_time);
      const endMin = timeToMinutes(tmpl.end_time);
      const duration = tmpl.slot_duration_minutes;

      if (endMin <= startMin) {
        console.warn(
          `${LOG_PREFIX} provider ${providerId}: template ${tmpl.id} has invalid ` +
            `time range ${tmpl.start_time}-${tmpl.end_time} (skipped)`
        );
        continue;
      }

      for (let cursor = startMin; cursor + duration <= endMin; cursor += duration) {
        const sh = Math.floor(cursor / 60);
        const sm = cursor % 60;
        const eh = Math.floor((cursor + duration) / 60);
        const em = (cursor + duration) % 60;
        const startTimeStr = `${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}:00`;
        const endTimeStr = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}:00`;
        const startIso = localSlotIso(dateStr, startTimeStr);
        const endIso = localSlotIso(dateStr, endTimeStr);

        if (existingSet.has(startIso)) {
          skippedExisting += 1;
          continue;
        }

        rows.push({
          provider_id: providerId,
          start_time: startIso,
          end_time: endIso,
          status: "open",
          source_template_id: tmpl.id,
        });
        existingSet.add(startIso);
      }
    }
  }

  console.log(
    `${LOG_PREFIX} provider ${providerId}: candidate rows=${rows.length} ` +
      `(template-day matches=${matchedTemplateDays}, skipped existing=${skippedExisting}, ` +
      `blocked days=${skippedBlocked})`
  );

  if (!rows.length) return 0;

  const { error: insertError } = await supabaseAdmin.from("provider_slots").insert(rows);
  if (insertError) {
    console.error(
      `${LOG_PREFIX} insert failed for provider ${providerId} (${rows.length} rows):`,
      insertError.message,
      insertError.details ?? "",
      insertError.hint ?? ""
    );
    throw new Error(insertError.message);
  }

  console.log(`${LOG_PREFIX} provider ${providerId}: inserted ${rows.length} slot(s)`);
  return rows.length;
}

/** Generate slots for all active providers. */
export async function generateAllProviderSlots(
  days: number = DEFAULT_HORIZON_DAYS
): Promise<number> {
  // Only filter on columns guaranteed by the base schema. compliance_suspended
  // lives in onboarding_availability.sql — omit it so slot generation works
  // before that migration is applied.
  const { data: providers, error: providerError } = await supabaseAdmin
    .from("providers")
    .select("id, first_name, last_name, status")
    .eq("status", "active");

  if (providerError) {
    console.error(`${LOG_PREFIX} provider query failed:`, providerError.message);
    throw new Error(providerError.message);
  }

  const list =
    (providers as Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      status: string;
    }> | null) ?? [];

  console.log(
    `${LOG_PREFIX} found ${list.length} active provider(s) ` +
      `(horizon=${days} days, tz=${OFFICE_TIMEZONE}, today=${officeToday()})`
  );
  for (const p of list) {
    const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.id;
    console.log(`${LOG_PREFIX}   • ${name} (${p.id})`);
  }

  if (!list.length) {
    // Help diagnose: are there providers with a different status?
    const { count: anyActive } = await supabaseAdmin
      .from("providers")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    const { count: allProviders } = await supabaseAdmin
      .from("providers")
      .select("id", { count: "exact", head: true });
    const { count: templateCount } = await supabaseAdmin
      .from("availability_templates")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);
    console.warn(
      `${LOG_PREFIX} no eligible providers — active total=${anyActive ?? 0}, ` +
        `all providers=${allProviders ?? 0}, active templates=${templateCount ?? 0}`
    );
    return 0;
  }

  let total = 0;
  for (const p of list) {
    try {
      total += await generateSlotsForProvider(p.id, days);
    } catch (err) {
      console.error(`${LOG_PREFIX} failed for provider ${p.id}:`, err);
    }
  }

  console.log(`${LOG_PREFIX} done — ${total} total slot(s) created across ${list.length} provider(s)`);
  return total;
}
