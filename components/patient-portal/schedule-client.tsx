"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarDays, Check, Clock, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ProviderInfo {
  id: string;
  name: string;
  credentials: string | null;
}

interface Slot {
  id: string;
  start_time: string;
  label: string;
}

interface PatientScheduleClientProps {
  provider: ProviderInfo;
  patientName: string;
  copay: number | null;
}

const DAYS_TO_SHOW = 14;
const OFFICE_TZ =
  process.env.NEXT_PUBLIC_OFFICE_TIMEZONE ?? "America/New_York";

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayOptions(): { key: string; weekday: string; day: string; month: string }[] {
  const out: { key: string; weekday: string; day: string; month: string }[] = [];
  const today = new Date();
  for (let i = 0; i < DAYS_TO_SHOW; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    out.push({
      key: toDateKey(date),
      weekday: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date),
      day: new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(date),
      month: new Intl.DateTimeFormat("en-US", { month: "short" }).format(date),
    });
  }
  return out;
}

function formatConfirmation(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "your selected time";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: OFFICE_TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function PatientScheduleClient({
  provider,
  patientName,
  copay,
}: PatientScheduleClientProps) {
  const days = dayOptions();
  const [selectedDate, setSelectedDate] = useState(days[0].key);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [booking, setBooking] = useState(false);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);

  const loadSlots = useCallback(
    async (date: string) => {
      setLoadingSlots(true);
      setSelectedSlot(null);
      try {
        const res = await fetch(
          `/api/schedule/slots?provider_id=${provider.id}&date=${date}`
        );
        const result = await res.json().catch(() => ({}));
        setSlots(res.ok ? (result.slots ?? []) : []);
      } catch {
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    },
    [provider.id]
  );

  useEffect(() => {
    void loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  async function confirmBooking() {
    if (!selectedSlot) return;
    setBooking(true);
    try {
      const res = await fetch("/api/patient-portal/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_id: selectedSlot.id }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(result.error ?? "Could not book this time. Try another.");
        await loadSlots(selectedDate);
        return;
      }
      setConfirmedAt(selectedSlot.start_time);
    } catch {
      toast.error("Could not book this time. Please try again.");
    } finally {
      setBooking(false);
    }
  }

  if (confirmedAt) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-12 sm:px-6">
        <Card className="border-teal/30">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-teal/10">
              <Check className="size-7 text-teal" />
            </span>
            <div>
              <h1 className="font-heading text-2xl font-semibold text-navy">
                You&apos;re all set, {patientName}!
              </h1>
              <p className="mt-2 text-navy/70">
                Your appointment with {provider.name} is confirmed for{" "}
                <span className="font-medium text-navy">
                  {formatConfirmation(confirmedAt)}
                </span>
                .
              </p>
              {copay != null && copay > 0 && (
                <p className="mt-1 text-sm text-navy/60">
                  Estimated copay: ${copay}
                </p>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link
                href="/patient-portal/dashboard"
                className={buttonVariants({
                  className: "bg-teal hover:bg-teal-700",
                })}
              >
                Go to Dashboard
              </Link>
              <Link
                href="/patient-portal/appointments"
                className={buttonVariants({ variant: "outline" })}
              >
                View Appointments
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">
          Schedule an appointment
        </h1>
        <p className="mt-1 text-navy/70">
          Booking with{" "}
          <span className="font-medium text-navy">{provider.name}</span>
          {provider.credentials ? `, ${provider.credentials}` : ""}
        </p>
      </div>

      <Card className="border-navy/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-lg text-navy">
            <CalendarDays className="size-5 text-teal" />
            Choose a day
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {days.map((d) => {
              const active = d.key === selectedDate;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setSelectedDate(d.key)}
                  className={`flex min-w-[64px] flex-col items-center rounded-xl border px-3 py-2 text-sm transition ${
                    active
                      ? "border-teal bg-teal text-white"
                      : "border-navy/10 bg-white text-navy hover:border-teal/40"
                  }`}
                >
                  <span className="text-xs uppercase opacity-80">
                    {d.weekday}
                  </span>
                  <span className="text-lg font-semibold">{d.day}</span>
                  <span className="text-xs opacity-80">{d.month}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-navy/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-lg text-navy">
            <Clock className="size-5 text-teal" />
            Available times
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSlots ? (
            <div className="flex items-center gap-2 py-6 text-navy/60">
              <Loader2 className="size-4 animate-spin" /> Loading times…
            </div>
          ) : slots.length === 0 ? (
            <p className="py-6 text-navy/60">
              No open times on this day. Try another date.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((slot) => {
                const active = selectedSlot?.id === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      active
                        ? "border-teal bg-teal text-white"
                        : "border-navy/10 bg-white text-navy hover:border-teal/40"
                    }`}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-navy/60">
          {selectedSlot
            ? `Selected: ${formatConfirmation(selectedSlot.start_time)}`
            : "Pick a time to continue."}
        </p>
        <Button
          className="bg-teal hover:bg-teal-700"
          disabled={!selectedSlot || booking}
          onClick={confirmBooking}
        >
          {booking ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Booking…
            </>
          ) : (
            "Confirm appointment"
          )}
        </Button>
      </div>
    </div>
  );
}
