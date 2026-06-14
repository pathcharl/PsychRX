// ============================================================================
// Provider matching engine.
//   * scoreProvider       — 0-100 fit score for a (provider, patient) pair
//   * matchPatientToProvider — best-scoring eligible provider
//   * findAvailableSlot   — next open slot for a provider
//   * holdSlot            — reserve a slot (default 10 minutes)
//   * confirmBooking      — turn a held/open slot into an appointment
//   * releaseExpiredHolds — free slots whose holds have lapsed
// All DB access uses supabaseAdmin.
// ============================================================================
import { supabaseAdmin } from "@/lib/supabase";

const DEFAULT_HOLD_MINUTES = 10;
const LOG_PREFIX = "[matching]";

/** Minimal patient shape the matcher needs. */
export interface MatchPatient {
  id?: string | null;
  insurance_provider?: string | null;
  language?: string | null;
  care_type?: string | null;
}

export interface ScoredProvider {
  id: string;
  first_name: string | null;
  last_name: string | null;
  status?: string | null;
  accepts_new_patients?: boolean | null;
  languages?: string[] | null;
  /** From providers.insurance_panels. */
  insurances?: string[] | null;
  /** Derived from providers.provider_type. */
  care_types?: string[] | null;
  specialties?: string[] | null;
}

export interface ScoreBreakdown {
  insurance: number;
  careType: number;
  language: number;
  specialty: number;
  availability: number;
}

export interface ScoreResult {
  score: number;
  breakdown: ScoreBreakdown;
  eligible: boolean;
}

// Weights (sum = 100).
const W = { insurance: 30, careType: 25, language: 15, specialty: 10, availability: 20 };

function providerLabel(p: ScoredProvider): string {
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.id;
  return `${name} (${p.id.slice(0, 8)}…)`;
}

function ineligibleReason(provider: ScoredProvider): string {
  if ((provider.status ?? "active") !== "active") return "status not active";
  if (provider.accepts_new_patients === false) return "not accepting new patients";
  return "unknown";
}

/** Count all open, future slots across the platform. */
async function countOpenSlots(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("provider_slots")
    .select("id", { count: "exact", head: true })
    .eq("status", "open")
    .gt("start_time", new Date().toISOString());
  if (error) {
    console.error(`${LOG_PREFIX} open-slot count query failed:`, error.message);
    return 0;
  }
  return count ?? 0;
}

/** Count open, future slots for one provider. */
async function countOpenSlotsForProvider(providerId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("provider_slots")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", providerId)
    .eq("status", "open")
    .gt("start_time", new Date().toISOString());
  return count ?? 0;
}

function logPatientCriteria(patient: MatchPatient): void {
  const label = patient.id ?? "unknown";
  console.log(
    `${LOG_PREFIX} patient ${label}: seeking ` +
      `care_type=${patient.care_type ?? "(none)"}, ` +
      `insurance=${patient.insurance_provider ?? "(none)"}, ` +
      `language=${patient.language ?? "English"}`
  );
}

/** Exact columns on the production providers table. */
const PROVIDER_COLS =
  "id, first_name, last_name, status, provider_type, specialties, insurance_panels, languages, accepts_new_patients";

interface ProviderDbRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  status: string | null;
  provider_type: string | null;
  specialties: string[] | null;
  insurance_panels: string[] | null;
  languages: string[] | null;
  accepts_new_patients: boolean | null;
}

function normalizeProviderRow(row: ProviderDbRow): ScoredProvider {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    status: row.status,
    accepts_new_patients: row.accepts_new_patients,
    languages: row.languages ?? ["English"],
    insurances: row.insurance_panels ?? [],
    care_types: row.provider_type ? [row.provider_type] : [],
    specialties: row.specialties ?? [],
  };
}

/** Load active providers accepting new patients. */
async function fetchActiveProviders(patientLabel: string): Promise<ScoredProvider[]> {
  const { data, error } = await supabaseAdmin
    .from("providers")
    .select(PROVIDER_COLS)
    .eq("status", "active")
    .eq("accepts_new_patients", true);

  if (error) {
    console.error(
      `${LOG_PREFIX} patient ${patientLabel}: provider query failed:`,
      error.message
    );
    return [];
  }

  return ((data as ProviderDbRow[] | null) ?? []).map(normalizeProviderRow);
}

function listIncludes(list: string[] | null | undefined, value: string | null | undefined): boolean {
  if (!list || !value) return false;
  const v = value.trim().toLowerCase();
  return list.some((item) => item.trim().toLowerCase() === v);
}

/**
 * Score how well a provider fits a patient (0-100).
 * A provider that is inactive, unavailable, or not accepting new patients is
 * ineligible (score 0).
 */
export function scoreProvider(
  provider: ScoredProvider,
  patient: MatchPatient
): ScoreResult {
  const empty: ScoreBreakdown = {
    insurance: 0,
    careType: 0,
    language: 0,
    specialty: 0,
    availability: 0,
  };

  const eligible =
    (provider.status ?? "active") === "active" &&
    provider.accepts_new_patients !== false;

  if (!eligible) return { score: 0, breakdown: empty, eligible: false };

  const breakdown: ScoreBreakdown = { ...empty };

  if (listIncludes(provider.insurances, patient.insurance_provider)) {
    breakdown.insurance = W.insurance;
  }
  if (listIncludes(provider.care_types, patient.care_type)) {
    breakdown.careType = W.careType;
  }
  if (listIncludes(provider.languages, patient.language ?? "English")) {
    breakdown.language = W.language;
  }
  if (
    listIncludes(provider.specialties, patient.care_type) ||
    listIncludes(provider.specialties, patient.insurance_provider)
  ) {
    breakdown.specialty = W.specialty;
  }
  // No per-provider fill-rate column in the schema; every eligible provider
  // gets full availability points (slot lookup decides actual availability).
  breakdown.availability = W.availability;

  const score =
    breakdown.insurance +
    breakdown.careType +
    breakdown.language +
    breakdown.specialty +
    breakdown.availability;

  return { score: Math.min(score, 100), breakdown, eligible: true };
}

export interface ProviderMatch {
  provider: ScoredProvider;
  score: number;
  breakdown: ScoreBreakdown;
}

/** Find the best-scoring eligible provider for a patient. */
export async function matchPatientToProvider(
  patient: MatchPatient
): Promise<ProviderMatch | null> {
  const providers = await fetchActiveProviders(patient.id ?? "unknown");
  let best: ProviderMatch | null = null;
  for (const provider of providers) {
    const { score, breakdown, eligible } = scoreProvider(provider, patient);
    if (!eligible || score <= 0) continue;
    if (!best || score > best.score) best = { provider, score, breakdown };
  }
  return best;
}

export interface Slot {
  id: string;
  provider_id: string;
  start_time: string;
  end_time: string | null;
  status: string;
}

/** Find the next open, future slot for a provider. */
export async function findAvailableSlot(providerId: string): Promise<Slot | null> {
  const { data } = await supabaseAdmin
    .from("provider_slots")
    .select("id, provider_id, start_time, end_time, status")
    .eq("provider_id", providerId)
    .eq("status", "open")
    .gt("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(1);
  return (data?.[0] as Slot | undefined) ?? null;
}

/**
 * Hold an open slot for a patient. Returns the held slot, or null if the slot
 * was already taken (conditional update on status = 'open').
 */
export async function holdSlot(
  slotId: string,
  patientId: string,
  minutes = DEFAULT_HOLD_MINUTES
): Promise<Slot | null> {
  const expires = new Date(Date.now() + minutes * 60_000).toISOString();
  const { data } = await supabaseAdmin
    .from("provider_slots")
    .update({
      status: "held",
      held_for_patient_id: patientId,
      hold_expires_at: expires,
    })
    .eq("id", slotId)
    .eq("status", "open")
    .select("id, provider_id, start_time, end_time, status")
    .maybeSingle();
  return (data as Slot | null) ?? null;
}

/**
 * Confirm a booking: creates the appointment, marks the slot booked, and
 * activates the patient. Returns the appointment id, or null if the slot is
 * no longer bookable / held by someone else.
 */
export async function confirmBooking(
  slotId: string,
  patientId: string,
  providerId: string
): Promise<{ appointmentId: string; slot: Slot } | null> {
  const { data: slotRow } = await supabaseAdmin
    .from("provider_slots")
    .select("id, provider_id, start_time, end_time, status, held_for_patient_id")
    .eq("id", slotId)
    .maybeSingle();
  const slot = slotRow as (Slot & { held_for_patient_id: string | null }) | null;
  if (!slot) return null;

  const bookable =
    slot.status === "open" ||
    (slot.status === "held" && slot.held_for_patient_id === patientId);
  if (!bookable) return null;

  const durationMinutes = slot.end_time
    ? Math.max(
        15,
        Math.round(
          (new Date(slot.end_time).getTime() - new Date(slot.start_time).getTime()) / 60_000
        )
      )
    : 60;

  const { data: appt, error: apptErr } = await supabaseAdmin
    .from("appointments")
    .insert({
      patient_id: patientId,
      provider_id: providerId,
      status: "scheduled",
      scheduled_at: slot.start_time,
      duration_minutes: durationMinutes,
    })
    .select("id")
    .maybeSingle();
  if (apptErr || !appt) return null;
  const appointmentId = (appt as { id: string }).id;

  // Mark the slot booked only if still bookable (guards against a race).
  const { data: updated } = await supabaseAdmin
    .from("provider_slots")
    .update({
      status: "booked",
      appointment_id: appointmentId,
      held_for_patient_id: patientId,
      hold_expires_at: null,
    })
    .eq("id", slotId)
    .in("status", ["open", "held"])
    .select("id")
    .maybeSingle();

  if (!updated) {
    // Lost the race — roll back the appointment we just created.
    await supabaseAdmin.from("appointments").delete().eq("id", appointmentId);
    return null;
  }

  // Activate the patient. (No primary_provider_id column in the schema.)
  await supabaseAdmin
    .from("patients")
    .update({ status: "active" })
    .eq("id", patientId);

  return { appointmentId, slot };
}

/** Release holds that have expired, returning the number freed. */
export async function releaseExpiredHolds(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("provider_slots")
    .update({ status: "open", held_for_patient_id: null, hold_expires_at: null })
    .eq("status", "held")
    .lt("hold_expires_at", new Date().toISOString())
    .select("id");
  return data?.length ?? 0;
}

// ---------------------------------------------------------------------------
// Composite helpers used by the intake API and matching worker
// ---------------------------------------------------------------------------

export interface MatchWithSlot {
  provider: ScoredProvider;
  score: number;
  breakdown: ScoreBreakdown;
  slot: Slot;
}

/** Find the best-scoring provider that also has an open upcoming slot. */
export async function findBestMatchWithSlot(
  patient: MatchPatient
): Promise<MatchWithSlot | null> {
  const patientLabel = patient.id ?? "unknown";
  logPatientCriteria(patient);

  const totalOpenSlots = await countOpenSlots();
  console.log(
    `${LOG_PREFIX} patient ${patientLabel}: ${totalOpenSlots} open slot(s) platform-wide`
  );

  const providers = await fetchActiveProviders(patientLabel);
  console.log(
    `${LOG_PREFIX} patient ${patientLabel}: ${providers.length} active/available provider(s) in pool`
  );

  if (!providers.length) {
    console.log(
      `${LOG_PREFIX} patient ${patientLabel}: FAILED — no providers with ` +
        `status=active, accepts_new_patients=true`
    );
    return null;
  }

  const evaluated = providers.map((provider) => ({
    provider,
    ...scoreProvider(provider, patient),
  }));

  const ineligible = evaluated.filter((s) => !s.eligible);
  const eligibleZeroScore = evaluated.filter((s) => s.eligible && s.score <= 0);
  const scored = evaluated
    .filter((s) => s.eligible && s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ineligible.length) {
    console.log(
      `${LOG_PREFIX} patient ${patientLabel}: ${ineligible.length} provider(s) ineligible:`,
      ineligible
        .map((s) => `${providerLabel(s.provider)} — ${ineligibleReason(s.provider)}`)
        .join("; ")
    );
  }

  if (!scored.length) {
    if (eligibleZeroScore.length) {
      console.log(
        `${LOG_PREFIX} patient ${patientLabel}: FAILED — ${eligibleZeroScore.length} eligible ` +
          `provider(s) but all scored 0 (no insurance/care_type/language/specialty overlap). ` +
          `Top candidates:`,
        eligibleZeroScore.slice(0, 3).map((s) => ({
          provider: providerLabel(s.provider),
          insurances: s.provider.insurances,
          care_types: s.provider.care_types,
          languages: s.provider.languages,
        }))
      );
    } else {
      console.log(
        `${LOG_PREFIX} patient ${patientLabel}: FAILED — all ${providers.length} provider(s) ineligible`
      );
    }
    return null;
  }

  console.log(
    `${LOG_PREFIX} patient ${patientLabel}: ${scored.length} scored candidate(s) — ` +
      scored
        .slice(0, 5)
        .map((s) => `${providerLabel(s.provider)} score=${s.score}`)
        .join(", ")
  );

  const noSlotReasons: string[] = [];
  for (const candidate of scored) {
    const openForProvider = await countOpenSlotsForProvider(candidate.provider.id);
    const slot = await findAvailableSlot(candidate.provider.id);
    if (slot) {
      console.log(
        `${LOG_PREFIX} patient ${patientLabel}: MATCHED ${providerLabel(candidate.provider)} ` +
          `score=${candidate.score}, slot=${slot.start_time} ` +
          `(provider has ${openForProvider} open slot(s))`
      );
      return {
        provider: candidate.provider,
        score: candidate.score,
        breakdown: candidate.breakdown,
        slot,
      };
    }
    noSlotReasons.push(
      `${providerLabel(candidate.provider)} (score=${candidate.score}, open_slots=${openForProvider})`
    );
  }

  console.log(
    `${LOG_PREFIX} patient ${patientLabel}: FAILED — ${scored.length} scored provider(s) ` +
      `but none had a bookable open slot. Checked: ${noSlotReasons.join("; ")}`
  );
  return null;
}

/** Append a row to the match audit log (best-effort). */
export async function logMatch(entry: {
  patientId?: string | null;
  providerId?: string | null;
  slotId?: string | null;
  score?: number | null;
  action:
    | "scored"
    | "matched"
    | "offered"
    | "booked"
    | "no_match"
    | "offer_expired"
    | "error";
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await supabaseAdmin.from("match_log").insert({
      patient_id: entry.patientId ?? null,
      provider_id: entry.providerId ?? null,
      slot_id: entry.slotId ?? null,
      score: entry.score ?? null,
      action: entry.action,
      details: entry.details ?? null,
    });
  } catch {
    // logging is best-effort
  }
}

/**
 * Confirm a patient's outstanding waitlist offer (e.g. when they reply YES).
 * Returns the booked appointment + provider, or null if there's no live offer
 * or the slot was lost.
 */
export async function confirmActiveOffer(
  patientId: string
): Promise<{ appointmentId: string; providerId: string } | null> {
  const { data } = await supabaseAdmin
    .from("waitlist")
    .select("id, offered_slot_id, offered_provider_id, offer_expires_at, status")
    .eq("patient_id", patientId)
    .eq("status", "offered")
    .gt("offer_expires_at", new Date().toISOString())
    .order("offered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const offer = data as
    | {
        id: string;
        offered_slot_id: string | null;
        offered_provider_id: string | null;
      }
    | null;
  if (!offer?.offered_slot_id || !offer.offered_provider_id) return null;

  const booked = await confirmBooking(
    offer.offered_slot_id,
    patientId,
    offer.offered_provider_id
  );

  if (!booked) {
    // Slot is gone — reset the waitlist entry so the worker re-offers.
    await supabaseAdmin
      .from("waitlist")
      .update({ status: "waiting", offered_slot_id: null, offered_provider_id: null, offer_expires_at: null })
      .eq("id", offer.id);
    return null;
  }

  await supabaseAdmin
    .from("waitlist")
    .update({ status: "booked", matched_at: new Date().toISOString() })
    .eq("id", offer.id);

  await logMatch({
    patientId,
    providerId: offer.offered_provider_id,
    slotId: offer.offered_slot_id,
    action: "booked",
    details: { via: "offer_confirmation" },
  });

  return { appointmentId: booked.appointmentId, providerId: offer.offered_provider_id };
}

/**
 * Decline a patient's outstanding offer: free the held slot and re-queue the
 * patient so the worker can offer a different slot. Returns true if an offer
 * was declined.
 */
export async function declineActiveOffer(patientId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("waitlist")
    .select("id, offered_slot_id, offered_provider_id")
    .eq("patient_id", patientId)
    .eq("status", "offered")
    .order("offered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const offer = data as
    | { id: string; offered_slot_id: string | null; offered_provider_id: string | null }
    | null;
  if (!offer) return false;

  if (offer.offered_slot_id) {
    await supabaseAdmin
      .from("provider_slots")
      .update({ status: "open", held_for_patient_id: null, hold_expires_at: null })
      .eq("id", offer.offered_slot_id)
      .eq("status", "held");
  }

  await supabaseAdmin
    .from("waitlist")
    .update({
      status: "waiting",
      offered_slot_id: null,
      offered_provider_id: null,
      offered_at: null,
      offer_expires_at: null,
    })
    .eq("id", offer.id);

  await logMatch({
    patientId,
    providerId: offer.offered_provider_id,
    slotId: offer.offered_slot_id,
    action: "offer_expired",
    details: { via: "patient_declined" },
  });
  return true;
}
