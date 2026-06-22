"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CalendarPlus,
  Phone,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PortalAppointment } from "@/lib/patient-portal/types";
import {
  buildAppleCalendarUrl,
  buildGoogleCalendarUrl,
  formatAppointmentDate,
  isJoinSessionActive,
  providerDisplayName,
} from "@/lib/patient-portal/utils";
import { cn } from "@/lib/utils";

interface NextAppointmentCardProps {
  appointment: PortalAppointment;
  patientPhone: string | null;
}

export function NextAppointmentCard({
  appointment,
  patientPhone,
}: NextAppointmentCardProps) {
  const [joinActive, setJoinActive] = useState(() =>
    isJoinSessionActive(appointment.scheduled_at)
  );

  useEffect(() => {
    const tick = () =>
      setJoinActive(isJoinSessionActive(appointment.scheduled_at));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [appointment.scheduled_at]);

  const providerName = appointment.provider
    ? providerDisplayName(appointment.provider)
    : "Your provider";
  const isVideo = appointment.session_modality === "video";
  const calendarTitle = `PsychRx session with ${providerName}`;
  const googleUrl = buildGoogleCalendarUrl({
    title: calendarTitle,
    start: appointment.scheduled_at,
    durationMinutes: appointment.duration_minutes,
    description: isVideo
      ? "Video session — join via your PsychRx patient portal."
      : "Phone session — your provider will call you.",
    location: isVideo ? appointment.telehealth_link ?? "Telehealth" : "Phone",
  });
  const appleUrl = buildAppleCalendarUrl({
    title: calendarTitle,
    start: appointment.scheduled_at,
    durationMinutes: appointment.duration_minutes,
  });

  return (
    <Card className="border-navy/10 bg-white shadow-md ring-navy/5">
      <CardHeader className="border-b border-navy/5 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal">
              Next Appointment
            </p>
            <CardTitle className="mt-1 font-heading text-2xl text-navy">
              {providerName}
            </CardTitle>
            <p className="mt-2 text-lg text-navy/80">
              {formatAppointmentDate(appointment.scheduled_at)}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "gap-1 border-teal/30 px-3 py-1 text-xs font-semibold uppercase",
              isVideo ? "text-teal" : "text-navy"
            )}
          >
            {isVideo ? (
              <>
                <Video className="size-3.5" />
                Video Session
              </>
            ) : (
              <>
                <Phone className="size-3.5" />
                Phone Session
              </>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-6">
        {isVideo ? (
          appointment.telehealth_link ? (
            joinActive ? (
              <a
                href={appointment.telehealth_link}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-14 w-full text-base font-semibold sm:w-auto sm:min-w-[220px] bg-teal text-white shadow-lg shadow-teal/30 hover:bg-teal-700"
                )}
                style={{ boxShadow: "0 0 20px rgba(34, 197, 94, 0.45)" }}
              >
                Join Session
              </a>
            ) : (
              <span
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "inline-flex h-14 w-full cursor-not-allowed text-base font-semibold opacity-70 sm:w-auto sm:min-w-[220px] bg-teal/40 text-white/80"
                )}
              >
                Join Session
              </span>
            )
          ) : (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Your video link will appear here before your session.
            </p>
          )
        ) : (
          <div className="rounded-lg border border-navy/10 bg-navy/5 px-4 py-3">
            <p className="text-sm font-medium text-navy">
              Your provider will call you at your appointment time
            </p>
            {patientPhone && (
              <p className="mt-1 text-sm text-navy/70">
                Phone on file: {patientPhone}
              </p>
            )}
          </div>
        )}

        {!joinActive && isVideo && (
          <p className="text-xs text-navy/60">
            Join Session activates 15 minutes before your appointment.
          </p>
        )}

        <div className="flex flex-wrap gap-4 text-sm">
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-teal hover:underline"
          >
            <CalendarPlus className="size-4" />
            Add to Google Calendar
          </a>
          <a
            href={appleUrl}
            download="psychrx-appointment.ics"
            className="inline-flex items-center gap-1.5 font-medium text-teal hover:underline"
          >
            <Calendar className="size-4" />
            Add to Apple Calendar
          </a>
        </div>
      </CardContent>

      <CardFooter className="justify-center border-t border-navy/5 pt-4">
        <Link
          href="/patient-portal/appointments?action=reschedule"
          className="text-sm text-navy/60 hover:text-teal hover:underline"
        >
          Need to reschedule?
        </Link>
      </CardFooter>
    </Card>
  );
}
