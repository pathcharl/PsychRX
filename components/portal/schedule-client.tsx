"use client";

import Link from "next/link";
import { ExternalLink, Phone } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatTime, patientDisplayName } from "@/lib/portal/utils";

interface ScheduleClientProps {
  appointments: Array<Record<string, unknown>>;
  telehealthLink: string | null;
}

export function ScheduleClient({
  appointments,
  telehealthLink,
}: ScheduleClientProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">
          Schedule
        </h1>
        <p className="mt-1 text-navy/70">Upcoming appointments (next 2 weeks)</p>
      </div>

      {appointments.length === 0 ? (
        <Card className="border-navy/10">
          <CardContent className="py-10 text-center text-navy/60">
            No upcoming appointments scheduled.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => {
            const rawPatient = appt.patient as Record<string, unknown> | Record<string, unknown>[] | null;
            const patient = Array.isArray(rawPatient) ? rawPatient[0] : rawPatient;
            const modality = appt.session_modality as string;
            const patientId = patient?.id as string | undefined;

            return (
              <Card key={appt.id as string} className="border-navy/10">
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-navy">
                      {formatDate(appt.start_time as string)} ·{" "}
                      {formatTime(appt.start_time as string)}
                    </p>
                    <p className="text-navy/80">
                      {patient
                        ? patientDisplayName(
                            patient.first_name as string,
                            patient.last_name as string
                          )
                        : "Patient"}
                    </p>
                    <p className="text-sm text-navy/60 capitalize">
                      {(patient?.insurance_payer as string) ?? "Self-pay"} ·{" "}
                      {(appt.appointment_type as string)?.replace("_", " ")} ·{" "}
                      {modality}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {modality === "video" ? (
                      (() => {
                        const joinLink =
                          (appt.telehealth_link as string) || telehealthLink || "";
                        return joinLink ? (
                          <a
                            href={joinLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={buttonVariants({
                              className: "gap-2 bg-teal hover:bg-teal-700",
                            })}
                          >
                            <ExternalLink className="size-4" /> Join Session
                          </a>
                        ) : (
                          <span
                            title="Add your telehealth link in Settings → Clinical Profile"
                            className={buttonVariants({
                              variant: "outline",
                              className:
                                "pointer-events-none gap-2 opacity-60",
                            })}
                          >
                            <ExternalLink className="size-4" /> Add telehealth link
                          </span>
                        );
                      })()
                    ) : (
                      <a
                        href={`tel:${patient?.phone ?? ""}`}
                        className={buttonVariants({
                          variant: "outline",
                          className: "gap-2",
                        })}
                      >
                        <Phone className="size-4" /> Call Patient
                      </a>
                    )}
                    {patientId && (
                      <Link
                        href={`/portal/patients/${patientId}`}
                        className={buttonVariants({ variant: "outline" })}
                      >
                        View
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
