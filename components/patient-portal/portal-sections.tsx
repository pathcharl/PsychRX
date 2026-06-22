"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Calendar,
  CalendarPlus,
  MessageSquare,
  Phone,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
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

interface AppointmentActionsProps {
  appointment: PortalAppointment;
  patient: PortalPatient;
}

export function AppointmentActions({
  appointment,
  patient,
}: AppointmentActionsProps) {
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const isVideo = appointment.session_modality === "video";
  const joinActive = isJoinSessionActive(appointment.scheduled_at);
  const cancelFee = getCancellationFee(appointment.scheduled_at);
  const rescheduleLimitReached = patient.reschedule_count_this_month >= 2;
  const rescheduleFee = getCancellationFee(appointment.scheduled_at);

  const providerName = appointment.provider
    ? providerDisplayName(appointment.provider)
    : "Your provider";

  function handleRescheduleConfirm() {
    if (!selectedDate) {
      toast.error("Please select a new date.");
      return;
    }
    toast.success("Reschedule request submitted. We'll confirm by text.");
    setRescheduleOpen(false);
  }

  function handleCancelConfirm() {
    if (cancelFee && cancelConfirm.trim().toUpperCase() !== "CANCEL") {
      toast.error('Please type CANCEL to confirm.');
      return;
    }
    toast.success("Appointment cancelled.");
    setCancelOpen(false);
    setCancelConfirm("");
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
            <>
              {rescheduleFee && (
                <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {rescheduleFee.label} applies for changes within{" "}
                  {rescheduleFee.fee >= 150 ? "2 hours" : "24 hours"} of your
                  appointment.
                </p>
              )}
              <CalendarPicker
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date()}
                className="mx-auto rounded-lg border"
              />
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleOpen(false)}>
              Close
            </Button>
            {!rescheduleLimitReached && (
              <Button onClick={handleRescheduleConfirm}>Confirm date</Button>
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
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep appointment
            </Button>
            <Button variant="destructive" onClick={handleCancelConfirm}>
              Cancel appointment
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
      href: "/schedule",
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
