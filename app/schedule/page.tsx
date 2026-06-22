"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays,
  format,
  isSameDay,
  startOfDay,
} from "date-fns";
import {
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Loader2,
  Pill,
  Calendar as CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/public/page-shell";
import { StepProgress } from "@/components/public/step-progress";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TOTAL_STEPS = 7;

const SERVICES = [
  {
    id: "therapy",
    title: "Therapy",
    credentials: "LCSW · LMFT · LPC",
    icon: Brain,
    description: "Individual psychotherapy sessions",
  },
  {
    id: "medication",
    title: "Medication Management",
    credentials: "PMHNP · Psychiatrist",
    icon: Pill,
    description: "Psychiatric evaluation & follow-ups",
  },
  {
    id: "testing",
    title: "Psychological Testing",
    credentials: "PhD · PsyD",
    icon: ClipboardList,
    description: "ADHD, learning, and diagnostic testing",
  },
];

const INSURANCE_OPTIONS = [
  "Aetna",
  "Cigna",
  "UnitedHealthcare",
  "BCBS FL",
  "Humana",
  "Self-pay",
] as const;

/** Map schedule UI labels → payer_id / payer name accepted by /api/insurance/verify */
const INSURANCE_PAYER_ID: Record<string, string> = {
  Aetna: "60054",
  Cigna: "62308",
  UnitedHealthcare: "87726",
  "BCBS FL": "00040",
  Humana: "61101",
};

interface ScheduleProvider {
  id: string;
  first_name: string;
  last_name: string;
  credentials: string | null;
  next_available: string;
  next_slot_id: string;
}

interface ScheduleSlot {
  id: string;
  start_time: string;
  label: string;
}

interface ConfirmedAppointment {
  provider_name: string;
  provider_credentials: string | null;
  scheduled_at: string;
  session_type: string;
}

interface BookingData {
  serviceType: string;
  insurance: string;
  memberId: string;
  insuranceVerified: boolean;
  planName: string;
  copay: number | null;
  providerId: string;
  selectedDate: Date | null;
  selectedSlotId: string;
  selectedTimeLabel: string;
  firstName: string;
  lastName: string;
  dob: string;
  email: string;
  phone: string;
  state: string;
  emergencyContact: string;
  agreedToPolicy: boolean;
}

const initialData: BookingData = {
  serviceType: "",
  insurance: "",
  memberId: "",
  insuranceVerified: false,
  planName: "",
  copay: null,
  providerId: "",
  selectedDate: null,
  selectedSlotId: "",
  selectedTimeLabel: "",
  firstName: "",
  lastName: "",
  dob: "",
  email: "",
  phone: "",
  state: "FL",
  emergencyContact: "",
  agreedToPolicy: false,
};

function slotPeriod(label: string): "Morning" | "Afternoon" | "Evening" {
  const match = /(\d+):(\d+)\s*(AM|PM)/i.exec(label);
  if (!match) return "Afternoon";
  let hour = parseInt(match[1], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

export default function SchedulePage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<BookingData>(initialData);
  const [verifying, setVerifying] = useState(false);
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const [providers, setProviders] = useState<ScheduleProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [confirmedAppointment, setConfirmedAppointment] =
    useState<ConfirmedAppointment | null>(null);

  const calendarDays = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 14 }, (_, i) => addDays(today, i));
  }, []);

  function updateField<K extends keyof BookingData>(
    key: K,
    value: BookingData[K]
  ) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  const loadProviders = useCallback(async (serviceType: string) => {
    setLoadingProviders(true);
    try {
      const res = await fetch(
        `/api/schedule/providers?service_type=${encodeURIComponent(serviceType)}`
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not load providers");
        setProviders([]);
        return;
      }
      setProviders(json.providers ?? []);
    } catch {
      toast.error("Could not load providers");
      setProviders([]);
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  const loadSlots = useCallback(async (providerId: string, date: Date) => {
    setLoadingSlots(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const res = await fetch(
        `/api/schedule/slots?provider_id=${encodeURIComponent(providerId)}&date=${dateStr}`
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not load times");
        setSlots([]);
        return;
      }
      setSlots(json.slots ?? []);
    } catch {
      toast.error("Could not load times");
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    if (step === 3 && data.serviceType) {
      void loadProviders(data.serviceType);
    }
  }, [step, data.serviceType, loadProviders]);

  useEffect(() => {
    if (step !== 4 || !data.providerId || !data.selectedDate) return;
    setData((prev) => ({
      ...prev,
      selectedSlotId: "",
      selectedTimeLabel: "",
    }));
    void loadSlots(data.providerId, data.selectedDate);
  }, [step, data.providerId, data.selectedDate, loadSlots]);

  function validateStep(): boolean {
    switch (step) {
      case 1:
        if (!data.serviceType) {
          toast.error("Please select a service type.");
          return false;
        }
        return true;
      case 2:
        if (!data.insurance) {
          toast.error("Please select your insurance.");
          return false;
        }
        if (data.insurance !== "Self-pay" && !data.insuranceVerified) {
          toast.error("Please verify your insurance.");
          return false;
        }
        return true;
      case 3:
        if (!data.providerId) {
          toast.error("Please select a provider.");
          return false;
        }
        return true;
      case 4:
        if (!data.selectedDate || !data.selectedSlotId) {
          toast.error("Please select a date and time.");
          return false;
        }
        return true;
      case 5:
        if (
          !data.firstName ||
          !data.lastName ||
          !data.dob ||
          !data.email ||
          !data.phone ||
          !data.emergencyContact
        ) {
          toast.error("Please complete all required fields.");
          return false;
        }
        return true;
      case 6:
        if (!data.agreedToPolicy) {
          toast.error("Please agree to the cancellation policy.");
          return false;
        }
        return true;
      default:
        return true;
    }
  }

  function nextStep() {
    if (!validateStep()) return;
    if (step === 6) {
      handleConfirm();
      return;
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 1));
  }

  async function verifyInsurance() {
    if (!data.insurance || !data.memberId) {
      toast.error("Enter insurance and member ID.");
      return;
    }

    const payload = {
      payer_id: INSURANCE_PAYER_ID[data.insurance] ?? data.insurance,
      member_id: data.memberId.trim(),
      patient_dob: data.dob || "1990-01-01",
    };
    console.log("[schedule] POST /api/insurance/verify", payload);

    setVerifying(true);
    try {
      const res = await fetch("/api/insurance/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      console.log("[schedule] /api/insurance/verify response", res.status, result);

      if (res.ok && result.verified !== false) {
        updateField("insuranceVerified", true);
        updateField(
          "planName",
          result.payer?.name ?? `${data.insurance} PPO`
        );
        updateField(
          "copay",
          result.coverage?.copay_estimate ?? 30
        );
        toast.success("Insurance verified");
      } else {
        const message =
          result.message ??
          result.error ??
          "Could not verify insurance. Check your member ID and try again.";
        toast.error(message);
      }
    } catch (err) {
      console.error("[schedule] /api/insurance/verify failed", err);
      toast.error("Insurance verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleConfirm() {
    setBooking(true);
    try {
      const payload = {
        provider_id: data.providerId,
        slot_id: data.selectedSlotId,
        service_type: data.serviceType,
        first_name: data.firstName,
        last_name: data.lastName,
        dob: data.dob,
        email: data.email,
        phone: data.phone,
        state: data.state,
        emergency_contact: data.emergencyContact,
        insurance: data.insurance,
        member_id: data.memberId,
      };
      const res = await fetch("/api/schedule/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error ?? "Booking failed. Please try another time.");
        if (res.status === 409 && data.providerId && data.selectedDate) {
          void loadSlots(data.providerId, data.selectedDate);
        }
        return;
      }
      setConfirmedAppointment(result.appointment);
      setStep(7);
      setConfirmed(true);
      setTimeout(() => setShowCheck(true), 100);
    } catch {
      toast.error("Booking failed. Please try again.");
    } finally {
      setBooking(false);
    }
  }

  const selectedProvider = providers.find((p) => p.id === data.providerId);

  const slotsByPeriod = useMemo(() => {
    const grouped: Record<string, ScheduleSlot[]> = {
      Morning: [],
      Afternoon: [],
      Evening: [],
    };
    for (const slot of slots) {
      grouped[slotPeriod(slot.label)].push(slot);
    }
    return grouped;
  }, [slots]);
  const selectedService = SERVICES.find((s) => s.id === data.serviceType);

  if (confirmed && step === 7) {
    return (
      <PageShell>
        <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
          <StepProgress currentStep={7} totalSteps={TOTAL_STEPS} className="mb-8" />

          <div className="text-center">
            <div
              className={cn(
                "mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-teal/10 transition-all duration-500",
                showCheck ? "scale-100 opacity-100" : "scale-50 opacity-0"
              )}
            >
              <Check className="size-10 text-teal" strokeWidth={3} />
            </div>

            <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">
              You&apos;re all set!
            </h1>
            <p className="mt-2 text-psych-text/70">
              Your appointment has been confirmed.
            </p>
          </div>

          <Card className="mt-8 border-navy/10">
            <CardHeader>
              <CardTitle className="font-heading text-navy">
                Appointment details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-psych-text/60">Service</span>
                <span className="font-medium">{selectedService?.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-psych-text/60">Provider</span>
                <span className="font-medium">
                  {confirmedAppointment?.provider_name ??
                    (selectedProvider
                      ? `${selectedProvider.first_name} ${selectedProvider.last_name.charAt(0)}., ${selectedProvider.credentials ?? ""}`
                      : "—")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-psych-text/60">Date</span>
                <span className="font-medium">
                  {confirmedAppointment?.scheduled_at
                    ? format(
                        new Date(confirmedAppointment.scheduled_at),
                        "EEEE, MMMM d"
                      )
                    : data.selectedDate
                      ? format(data.selectedDate, "EEEE, MMMM d")
                      : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-psych-text/60">Time</span>
                <span className="font-medium">
                  {data.selectedTimeLabel || "—"}
                </span>
              </div>
              {data.copay !== null && (
                <div className="flex justify-between">
                  <span className="text-psych-text/60">Copay</span>
                  <span className="font-medium">${data.copay}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" className="flex-1 border-navy/20">
              <CalendarIcon className="mr-2 size-4" />
              Add to Google Calendar
            </Button>
            <Button variant="outline" className="flex-1 border-navy/20">
              <CalendarIcon className="mr-2 size-4" />
              Add to Apple Calendar
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold text-navy">
            Book an Appointment
          </h1>
          <p className="mt-2 text-psych-text/70">
            Matched to a provider this week — usually in under 3 days
          </p>
        </div>

        <StepProgress currentStep={step} totalSteps={TOTAL_STEPS} className="mb-8" />

        {/* Step 1: Service type */}
        {step === 1 && (
          <div className="grid gap-4">
            {SERVICES.map((service) => {
              const selected = data.serviceType === service.id;
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => updateField("serviceType", service.id)}
                  className={cn(
                    "flex items-start gap-4 rounded-xl border p-6 text-left transition-all",
                    selected
                      ? "border-teal bg-teal/5 shadow-md"
                      : "border-navy/10 bg-white hover:border-teal/30 hover:shadow-sm"
                  )}
                >
                  <div
                    className={cn(
                      "flex size-12 shrink-0 items-center justify-center rounded-xl",
                      selected
                        ? "bg-teal text-white"
                        : "bg-teal/10 text-teal"
                    )}
                  >
                    <service.icon className="size-6" />
                  </div>
                  <div>
                    <p className="font-heading text-lg font-semibold text-navy">
                      {service.title}
                    </p>
                    <p className="text-sm font-medium text-teal">
                      {service.credentials}
                    </p>
                    <p className="mt-1 text-sm text-psych-text/60">
                      {service.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2: Insurance */}
        {step === 2 && (
          <Card className="border-navy/10">
            <CardHeader>
              <CardTitle className="font-heading text-navy">
                Verify insurance
              </CardTitle>
              <CardDescription>
                We&apos;ll confirm your coverage and copay before matching
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Insurance plan</Label>
                <Select
                  value={data.insurance}
                  onValueChange={(v) => {
                    updateField("insurance", v ?? "");
                    updateField("insuranceVerified", v === "Self-pay");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select insurance" />
                  </SelectTrigger>
                  <SelectContent>
                    {INSURANCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {data.insurance && data.insurance !== "Self-pay" && (
                <>
                  <div className="space-y-2">
                    <Label>Member ID</Label>
                    <Input
                      value={data.memberId}
                      onChange={(e) => {
                        updateField("memberId", e.target.value);
                        updateField("insuranceVerified", false);
                      }}
                      placeholder="Found on your insurance card"
                    />
                  </div>
                  <Button
                    className="bg-teal text-white hover:bg-teal-700"
                    onClick={verifyInsurance}
                    disabled={verifying}
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify Insurance"
                    )}
                  </Button>
                </>
              )}

              {data.insuranceVerified && data.insurance !== "Self-pay" && (
                <div className="rounded-lg border border-teal/30 bg-teal/5 p-4">
                  <p className="font-medium text-teal">Coverage verified</p>
                  <p className="text-sm text-psych-text/70">
                    {data.planName} · Copay ${data.copay}
                  </p>
                </div>
              )}

              {data.insurance === "Self-pay" && (
                <div className="rounded-lg bg-psych-bg p-4 text-sm text-psych-text/70">
                  Self-pay rates: Initial visit $250 · Follow-up $150
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Provider match */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-psych-text/70">
              Providers with open appointments for your selected service
            </p>
            {loadingProviders ? (
              <div className="flex items-center justify-center py-12 text-psych-text/60">
                <Loader2 className="mr-2 size-5 animate-spin" />
                Loading available providers…
              </div>
            ) : providers.length === 0 ? (
              <div className="rounded-xl border border-navy/10 bg-psych-bg p-6 text-center text-sm text-psych-text/70">
                No providers have open slots right now. Try another service type
                or check back soon.
              </div>
            ) : (
              providers.map((provider) => {
                const selected = data.providerId === provider.id;
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => updateField("providerId", provider.id)}
                    className={cn(
                      "w-full rounded-xl border p-5 text-left transition-all",
                      selected
                        ? "border-teal bg-teal/5 shadow-md"
                        : "border-navy/10 bg-white hover:border-teal/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-heading text-lg font-semibold text-navy">
                          {provider.first_name}{" "}
                          {provider.last_name.charAt(0)}.,{" "}
                          {provider.credentials}
                        </p>
                        <p className="mt-1 text-sm text-teal">
                          Next available: {provider.next_available}
                        </p>
                      </div>
                      {selected && (
                        <Check className="size-5 shrink-0 text-teal" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Step 4: Time selection */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <Label className="mb-3 block">Select a date</Label>
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {calendarDays.map((day) => {
                  const selected =
                    data.selectedDate && isSameDay(day, data.selectedDate);
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      disabled={isWeekend}
                      onClick={() => updateField("selectedDate", day)}
                      className={cn(
                        "flex flex-col items-center rounded-lg border py-2 text-xs transition-colors sm:py-3 sm:text-sm",
                        selected
                          ? "border-teal bg-teal text-white"
                          : isWeekend
                            ? "cursor-not-allowed border-navy/5 text-psych-text/30"
                            : "border-navy/10 hover:border-teal/30"
                      )}
                    >
                      <span className="font-medium">{format(day, "EEE")}</span>
                      <span>{format(day, "d")}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {data.selectedDate && (
              <div className="space-y-4">
                {loadingSlots ? (
                  <div className="flex items-center gap-2 text-sm text-psych-text/60">
                    <Loader2 className="size-4 animate-spin" />
                    Loading times…
                  </div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-psych-text/60">
                    No open times on this day. Pick another date.
                  </p>
                ) : (
                  Object.entries(slotsByPeriod).map(([period, periodSlots]) =>
                    periodSlots.length === 0 ? null : (
                      <div key={period}>
                        <p className="mb-2 text-sm font-medium text-navy">
                          {period}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {periodSlots.map((slot) => {
                            const selected = data.selectedSlotId === slot.id;
                            return (
                              <button
                                key={slot.id}
                                type="button"
                                onClick={() => {
                                  updateField("selectedSlotId", slot.id);
                                  updateField("selectedTimeLabel", slot.label);
                                }}
                                className={cn(
                                  "rounded-lg border px-3 py-2 text-sm transition-colors",
                                  selected
                                    ? "border-teal bg-teal text-white"
                                    : "border-navy/10 hover:border-teal/30"
                                )}
                              >
                                {slot.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )
                  )
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 5: Patient info */}
        {step === 5 && (
          <Card className="border-navy/10">
            <CardHeader>
              <CardTitle className="font-heading text-navy">
                Your information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First name *</Label>
                <Input
                  value={data.firstName}
                  onChange={(e) => updateField("firstName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Last name *</Label>
                <Input
                  value={data.lastName}
                  onChange={(e) => updateField("lastName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Date of birth *</Label>
                <Input
                  type="date"
                  value={data.dob}
                  onChange={(e) => updateField("dob", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input
                  type="tel"
                  value={data.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={data.email}
                  onChange={(e) => updateField("email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={data.state}
                  onChange={(e) => updateField("state", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Emergency contact *</Label>
                <Input
                  value={data.emergencyContact}
                  onChange={(e) =>
                    updateField("emergencyContact", e.target.value)
                  }
                  placeholder="Name and phone"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 6: Payment */}
        {step === 6 && (
          <Card className="border-navy/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-navy">
                <CreditCard className="size-5 text-teal" />
                Card on file
              </CardTitle>
              <CardDescription>
                A card is required to hold your appointment. You won&apos;t be
                charged until after your visit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border-2 border-dashed border-navy/20 bg-psych-bg p-8 text-center">
                <CreditCard className="mx-auto size-8 text-navy/30" />
                <p className="mt-3 text-sm font-medium text-navy">
                  Stripe Payment Element
                </p>
                <p className="mt-1 text-xs text-psych-text/50">
                  Card entry will appear here when Stripe is connected
                </p>
              </div>

              <p className="text-xs text-psych-text/60">
                Cancellation policy: Cancel free up to 24 hours before your
                appointment. Late cancellations may incur a $75 fee.
              </p>

              <button
                type="button"
                onClick={() =>
                  updateField("agreedToPolicy", !data.agreedToPolicy)
                }
                className="flex items-start gap-3 text-left"
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2",
                    data.agreedToPolicy
                      ? "border-teal bg-teal text-white"
                      : "border-navy/30"
                  )}
                >
                  {data.agreedToPolicy && <Check className="size-3" />}
                </span>
                <span className="text-sm text-psych-text/70">
                  I agree to the cancellation policy and authorize PsychRx to
                  store my payment method.
                </span>
              </button>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 flex justify-between gap-4">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={step === 1}
            className="border-navy/20"
          >
            <ChevronLeft className="mr-1 size-4" />
            Back
          </Button>

          <Button
            className="bg-teal text-white hover:bg-teal-700"
            onClick={nextStep}
            disabled={booking}
          >
            {booking ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Confirming...
              </>
            ) : step === 6 ? (
              "Confirm Appointment"
            ) : (
              <>
                Continue
                <ChevronRight className="ml-1 size-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
