"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  Calendar,
  CalendarPlus,
  Loader2,
  MessageSquare,
  Phone,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PortalAppointment, PortalPatient } from "@/lib/patient-portal/types";
import {
  buildAppleCalendarUrl,
  buildGoogleCalendarUrl,
  formatAppointmentDate,
  formatCurrency,
  getCancellationFee,
  isJoinSessionActive,
  providerDisplayName,
} from "@/lib/patient-portal/utils";
import { toast } from "sonner";

interface RescheduleSlot {
  id: string;
  start_time: string;
  label: string;
}

const RESCHEDULE_DAYS_TO_SHOW = 14;

function rsDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function rescheduleDayOptions(): { key: string; weekday: string; day: string }[] {
  const out: { key: string; weekday: string; day: string }[] = [];
  const today = new Date();
  for (let i = 0; i < RESCHEDULE_DAYS_TO_SHOW; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    out.push({
      key: rsDateKey(date),
      weekday: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date),
      day: new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(date),
    });
  }
  return out;
}

interface AppointmentActionsProps {
  appointment: PortalAppointment;
  patient: PortalPatient;
}

export function AppointmentActions({
  appointment,
  patient,
}: AppointmentActionsProps) {
  const router = useRouter();
  const rescheduleDays = useMemo(() => rescheduleDayOptions(), []);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rsDay, setRsDay] = useState<string>(() => rescheduleDayOptions()[0].key);
  const [rsSlots, setRsSlots] = useState<RescheduleSlot[]>([]);
  const [rsLoading, setRsLoading] = useState(false);
  const [rsSlot, setRsSlot] = useState<RescheduleSlot | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const isVideo = appointment.session_modality === "video";
  const joinActive = isJoinSessionActive(appointment.scheduled_at);
  const cancelFee = getCancellationFee(appointment.scheduled_at);
  const rescheduleLimitReached = patient.reschedule_count_this_month >= 2;
  const rescheduleFee = getCancellationFee(appointment.scheduled_at);

  const providerName = appointment.provider
    ? providerDisplayName(appointment.provider)
    : "Your provider";

  const loadRescheduleSlots = useCallback(
    async (day: string) => {
      setRsLoading(true);
      setRsSlot(null);
      try {
        const res = await fetch(
          `/api/schedule/slots?provider_id=${appointment.provider_id}&date=${day}`
        );
        const result = await res.json().catch(() => ({}));
        setRsSlots(res.ok ? (result.slots ?? []) : []);
      } catch {
        setRsSlots([]);
      } finally {
        setRsLoading(false);
      }
    },
    [appointment.provider_id]
  );

  useEffect(() => {
    if (rescheduleOpen && !rescheduleLimitReached) {
      void loadRescheduleSlots(rsDay);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rescheduleOpen, rsDay]);

  async function handleRescheduleConfirm() {
    if (!rsSlot) {
      toast.error("Please select a new time.");
      return;
    }
    setRescheduling(true);
    try {
      const res = await fetch("/api/appointments/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: appointment.id,
          new_slot_id: rsSlot.id,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(result.error ?? "Could not reschedule. Try another time.");
        await loadRescheduleSlots(rsDay);
        return;
      }
      toast.success("Appointment rescheduled.");
      setRescheduleOpen(false);
      router.refresh();
    } catch {
      toast.error("Could not reschedule. Please try again.");
    } finally {
      setRescheduling(false);
    }
  }

  async function handleCancelConfirm() {
    if (cancelFee && cancelConfirm.trim().toUpperCase() !== "CANCEL") {
      toast.error('Please type CANCEL to confirm.');
      return;
    }
    setCancelling(true);
    try {
      const res = await fetch("/api/appointments/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: appointment.id,
          cancelled_by: "patient",
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(result.error ?? "Could not cancel appointment.");
        return;
      }
      toast.success("Appointment cancelled.");
      setCancelOpen(false);
      setCancelConfirm("");
      router.refresh();
    } catch {
      toast.error("Could not cancel the appointment. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isVideo && appointment.telehealth_link && (
        joinActive ? (
          <a
            href={appointment.telehealth_link}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({
              size: "sm",
              className: "shadow-lg shadow-green-400/40",
            })}
          >
            Join Session
          </a>
        ) : (
          <Button size="sm" disabled>
            Join Session
          </Button>
        )
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => setRescheduleOpen(true)}
      >
        Reschedule
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setCancelOpen(true)}
      >
        Cancel
      </Button>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule appointment</DialogTitle>
            <DialogDescription>
              With {providerName} on{" "}
              {formatAppointmentDate(appointment.scheduled_at)}
            </DialogDescription>
          </DialogHeader>

          {rescheduleLimitReached ? (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Monthly limit reached. Call{" "}
              <a href="tel:18337792479" className="font-semibold underline">
                1-833-PSYCHRX
              </a>
              .
            </p>
          ) : (
            <div className="space-y-4">
              {rescheduleFee && (
                <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {rescheduleFee.label} applies for changes within{" "}
                  {rescheduleFee.fee >= 150 ? "2 hours" : "24 hours"} of your
                  appointment.
                </p>
              )}

              <div>
                <p className="mb-2 text-sm font-medium text-navy">Choose a day</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {rescheduleDays.map((d) => {
                    const active = d.key === rsDay;
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => setRsDay(d.key)}
                        className={`flex min-w-[52px] flex-col items-center rounded-lg border px-2 py-1.5 text-xs transition ${
                          active
                            ? "border-teal bg-teal text-white"
                            : "border-navy/10 bg-white text-navy hover:border-teal/40"
                        }`}
                      >
                        <span className="uppercase opacity-80">{d.weekday}</span>
                        <span className="text-base font-semibold">{d.day}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-navy">
                  Available times
                </p>
                {rsLoading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-navy/60">
                    <Loader2 className="size-4 animate-spin" /> Loading times…
                  </div>
                ) : rsSlots.length === 0 ? (
                  <p className="py-4 text-sm text-navy/60">
                    No open times on this day. Try another date.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {rsSlots.map((slot) => {
                      const active = rsSlot?.id === slot.id;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setRsSlot(slot)}
                          className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${
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
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRescheduleOpen(false)}
              disabled={rescheduling}
            >
              Close
            </Button>
            {!rescheduleLimitReached && (
              <Button
                onClick={handleRescheduleConfirm}
                disabled={!rsSlot || rescheduling}
              >
                {rescheduling ? "Rescheduling…" : "Confirm time"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel appointment</DialogTitle>
            <DialogDescription>
              {cancelFee
                ? `${cancelFee.label} will be charged to the card on file.`
                : "No fee for cancellations 24+ hours in advance."}
            </DialogDescription>
          </DialogHeader>

          {cancelFee && (
            <div className="space-y-2">
              <Label htmlFor="cancel-confirm">
                Type <strong>CANCEL</strong> to confirm
              </Label>
              <Input
                id="cancel-confirm"
                value={cancelConfirm}
                onChange={(e) => setCancelConfirm(e.target.value)}
                placeholder="CANCEL"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={cancelling}
            >
              Keep appointment
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling…" : "Cancel appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface UpcomingAppointmentRowProps {
  appointment: PortalAppointment;
  patient: PortalPatient;
}

export function UpcomingAppointmentRow({
  appointment,
  patient,
}: UpcomingAppointmentRowProps) {
  const isVideo = appointment.session_modality === "video";
  const providerName = appointment.provider
    ? providerDisplayName(appointment.provider)
    : "Provider";

  const googleUrl = buildGoogleCalendarUrl({
    title: `PsychRx — ${providerName}`,
    start: appointment.scheduled_at,
    durationMinutes: appointment.duration_minutes,
  });
  const appleUrl = buildAppleCalendarUrl({
    title: `PsychRx — ${providerName}`,
    start: appointment.scheduled_at,
    durationMinutes: appointment.duration_minutes,
  });

  return (
    <div className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="font-heading text-lg font-medium text-navy">
            {providerName}
          </p>
          <p className="text-navy/70">
            {formatAppointmentDate(appointment.scheduled_at)}
          </p>
          <Badge
            variant="outline"
            className="gap-1 border-teal/30 text-xs font-semibold uppercase"
          >
            {isVideo ? (
              <>
                <Video className="size-3.5" /> Video Session
              </>
            ) : (
              <>
                <Phone className="size-3.5" /> Phone Session
              </>
            )}
          </Badge>
        </div>
        <AppointmentActions appointment={appointment} patient={patient} />
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-teal hover:underline"
        >
          <CalendarPlus className="size-4" /> Google Calendar
        </a>
        <a
          href={appleUrl}
          download="appointment.ics"
          className="inline-flex items-center gap-1 text-teal hover:underline"
        >
          <Calendar className="size-4" /> Apple Calendar
        </a>
      </div>
    </div>
  );
}

export function RequestSoonerForm({ patientId }: { patientId: string }) {
  const [urgency, setUrgency] = useState("routine");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) {
      toast.error("Please share a brief reason.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "waitlist_sooner",
          patient_id: patientId,
          urgency,
          reason,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      toast.success("Added to waitlist. We'll text you if a slot opens.");
      setReason("");
    } catch {
      toast.success("Request received. We'll contact you if a slot opens.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
      <h3 className="font-heading text-lg font-medium text-navy">
        Request sooner appointment
      </h3>
      <p className="mt-1 text-sm text-navy/70">
        Tell us how soon you need to be seen. We&apos;ll add you to the waitlist.
      </p>
      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label>Urgency</Label>
          <Select value={urgency} onValueChange={(v) => v && setUrgency(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="routine">Routine</SelectItem>
              <SelectItem value="soon">Soon (within 1–2 weeks)</SelectItem>
              <SelectItem value="urgent">Urgent (as soon as possible)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sooner-reason">Reason</Label>
          <Textarea
            id="sooner-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Briefly describe why you'd like an earlier appointment"
            rows={3}
          />
        </div>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? "Submitting…" : "Submit request"}
        </Button>
      </div>
    </div>
  );
}

export function PastAppointmentRow({
  appointment,
}: {
  appointment: {
    id: string;
    scheduled_at: string;
    session_modality: string;
    provider: { first_name: string; credentials: string | null } | null;
    amount_billed: number | null;
    insurance_paid: number | null;
    patient_owed: number | null;
  };
}) {
  const providerName = appointment.provider
    ? providerDisplayName(appointment.provider)
    : "Provider";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-navy/10 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-navy">
          {format(new Date(appointment.scheduled_at), "MMM d, yyyy")}
        </p>
        <p className="text-sm text-navy/70">{providerName}</p>
        <p className="text-xs uppercase text-navy/50">
          {appointment.session_modality === "video" ? "Video" : "Phone"} session
        </p>
      </div>
      <div className="text-sm text-navy/70">
        <p>Billed: {formatCurrency(appointment.amount_billed)}</p>
        <p>Insurance paid: {formatCurrency(appointment.insurance_paid)}</p>
        <p>You owed: {formatCurrency(appointment.patient_owed)}</p>
      </div>
      <Link
        href={`/patient-portal/billing?superbill=${appointment.id}`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Download Superbill
      </Link>
    </div>
  );
}

export function CareTeamCard({
  provider,
}: {
  provider: {
    id: string;
    first_name: string;
    credentials: string | null;
    specialties: string[];
  };
}) {
  return (
    <div className="rounded-xl border border-navy/10 bg-white p-5 shadow-sm">
      <p className="font-heading text-lg font-medium text-navy">
        {providerDisplayName(provider)}
      </p>
      {provider.specialties.length > 0 && (
        <p className="mt-2 text-sm text-navy/70">
          {provider.specialties.slice(0, 3).join(" · ")}
        </p>
      )}
      <Link
        href={`/patient-portal/messages?provider=${provider.id}`}
        className={buttonVariants({ variant: "outline", size: "sm", className: "mt-4 gap-1" })}
      >
        <MessageSquare className="size-4" />
        Message
      </Link>
    </div>
  );
}

export function QuickActions() {
  const actions = [
    {
      label: "Schedule Appointment",
      href: "/patient-portal/schedule",
      icon: Calendar,
    },
    {
      label: "Message Provider",
      href: "/patient-portal/messages",
      icon: MessageSquare,
    },
    {
      label: "Download Superbill",
      href: "/patient-portal/billing",
      icon: CalendarPlus,
    },
    {
      label: "Update Insurance",
      href: "/patient-portal/billing?tab=insurance",
      icon: Calendar,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {actions.map((action) => (
        <Link
          key={action.label}
          href={action.href}
          className="flex items-center gap-3 rounded-xl border border-navy/10 bg-white p-4 text-sm font-medium text-navy shadow-sm transition hover:border-teal/30 hover:shadow-md"
        >
          <action.icon className="size-5 text-teal" />
          {action.label}
        </Link>
      ))}
    </div>
  );
}
