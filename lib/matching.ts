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
  available?: boolean | null;
  accepts_new_patients?: boolean | null;
  languages?: string[] | null;
  insurances?: string[] | null;
  care_types?: string[] | null;
  specialties?: string[] | null;
  fill_rate?: number | null;
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
    provider.available !== false &&
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
  // Lower fill rate -> more availability -> more points.
  const fill = Math.min(Math.max(provider.fill_rate ?? 0, 0), 1);
  breakdown.availability = Math.round((1 - fill) * W.availability);

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
  const { data } = await supabaseAdmin
    .from("providers")
    .select(
      "id, first_name, last_name, status, available, accepts_new_patients, languages, insurances, care_types, specialties, fill_rate"
    )
    .eq("status", "active")
    .eq("available", true)
    .eq("accepts_new_patients", true);

  const providers = (data as ScoredProvider[] | null) ?? [];
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

  const { data: appt, error: apptErr } = await supabaseAdmin
    .from("appointments")
    .insert({
      patient_id: patientId,
      provider_id: providerId,
      appointment_type: "intake",
      status: "scheduled",
      scheduled_start: slot.start_time,
      scheduled_end: slot.end_time,
      notes: "Booked via matching engine.",
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

  // Activate the patient and set a primary provider if they don't have one.
  await supabaseAdmin
    .from("patients")
    .update({ status: "active" })
    .eq("id", patientId);
  await supabaseAdmin
    .from("patients")
    .update({ primary_provider_id: providerId })
    .eq("id", patientId)
    .is("primary_provider_id", null);

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
  const { data } = await supabaseAdmin
    .from("providers")
    .select(
      "id, first_name, last_name, status, available, accepts_new_patients, languages, insurances, care_types, specialties, fill_rate"
    )
    .eq("status", "active")
    .eq("available", true)
    .eq("accepts_new_patients", true);

  const scored = ((data as ScoredProvider[] | null) ?? [])
    .map((provider) => ({ provider, ...scoreProvider(provider, patient) }))
    .filter((s) => s.eligible && s.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const candidate of scored) {
    const slot = await findAvailableSlot(candidate.provider.id);
    if (slot) {
      return {
        provider: candidate.provider,
        score: candidate.score,
        breakdown: candidate.breakdown,
        slot,
      };
    }
  }
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
