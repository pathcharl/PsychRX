"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Phone,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/lib/portal/types";
import {
  celebrationEmoji,
  fillRateBg,
  fillRateColor,
  formatCurrency,
  formatTime,
  canJoinSession,
  patientDisplayName,
} from "@/lib/portal/utils";

export function DashboardClient({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [celebration, setCelebration] = useState(data.celebration);
  const [dismissing, setDismissing] = useState(false);

  async function dismissCelebration() {
    if (!celebration) return;
    setDismissing(true);
    try {
      const res = await fetch("/api/portal/celebration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id: celebration.id }),
      });
      if (!res.ok) throw new Error("Failed to dismiss");
      setCelebration(null);
      toast.success("Congratulations!");
    } catch {
      toast.error("Could not dismiss banner. Try again.");
    } finally {
      setDismissing(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">
          Dashboard
        </h1>
        <p className="mt-1 text-navy/70">Today&apos;s sessions and metrics</p>
      </div>

      {celebration && (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-teal to-teal-700 p-6 text-white shadow-lg">
          <button
            type="button"
            onClick={dismissCelebration}
            disabled={dismissing}
            className="absolute right-4 top-4 rounded-full p-1 hover:bg-white/20"
            aria-label="Dismiss"
          >
            <X className="size-5" />
          </button>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <span className="text-4xl">
              {celebrationEmoji(celebration.celebration_level)}
            </span>
            <div>
              <p className="font-heading text-xl font-semibold">
                Your payment of {formatCurrency(celebration.provider_amount)} is
                on its way!
              </p>
              <p className="mt-1 text-sm text-white/90">
                {celebration.session_count ?? 0} sessions ·{" "}
                {celebration.unique_patients ?? 0} patients helped
              </p>
            </div>
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-4 font-heading text-xl font-semibold text-navy">
          Today&apos;s Sessions
        </h2>
        {data.todaySessions.length === 0 ? (
          <Card className="border-navy/10">
            <CardContent className="py-10 text-center text-navy/60">
              No sessions scheduled for today.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.todaySessions.map((session) => {
              const joinable = canJoinSession(session.start_time);
              const isCompleted = session.status === "completed";

              return (
                <Card key={session.id} className="border-navy/10">
                  <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-navy">
                        {formatTime(session.start_time)} ·{" "}
                        {patientDisplayName(
                          session.patient.first_name,
                          session.patient.last_name
                        )}
                      </p>
                      <p className="text-sm text-navy/60">
                        {session.patient.insurance_payer ?? "Self-pay"} ·{" "}
                        {session.appointment_type?.replace("_", " ") ?? "Session"}{" "}
                        · {session.session_modality}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
                          <Check className="size-4" /> Done
                        </span>
                      ) : session.session_modality === "video" ? (
                        <a
                          href={session.telehealth_link ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonVariants({
                            className: cn(
                              "gap-2",
                              joinable
                                ? "bg-emerald-600 hover:bg-emerald-700"
                                : "bg-teal hover:bg-teal-700"
                            ),
                          })}
                        >
                          <ExternalLink className="size-4" />
                          Join Session
                        </a>
                      ) : (
                        <a
                          href={`tel:${session.patient.phone ?? ""}`}
                          className={buttonVariants({
                            variant: "outline",
                            className: "gap-2",
                          })}
                        >
                          <Phone className="size-4" />
                          Call Patient
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card className="border-navy/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg text-navy">
              Fill Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <span
                className={cn(
                  "font-heading text-4xl font-bold",
                  fillRateColor(data.fillRate)
                )}
              >
                {Math.round(data.fillRate)}%
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-navy/10">
              <div
                className={cn("h-full transition-all", fillRateBg(data.fillRate))}
                style={{ width: `${Math.min(100, data.fillRate)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-navy/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg text-navy">
              Notes Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                "font-heading text-4xl font-bold",
                data.notesDue > 0 ? "text-red-600" : "text-navy"
              )}
            >
              {data.notesDue}
            </p>
            {data.notesDue > 0 && (
              <Link
                href="/portal/scribe"
                className="mt-2 inline-block text-sm font-medium text-teal hover:underline"
              >
                Submit Now →
              </Link>
            )}
          </CardContent>
        </Card>

        <Card className="border-navy/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg text-navy">
              Next Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-4xl font-bold text-navy">
              {formatCurrency(data.nextPaymentEstimate)}
            </p>
            <p className="mt-1 text-sm text-navy/60">Estimated this week</p>
          </CardContent>
        </Card>

        <Card className="border-navy/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg text-navy">
              Document Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.documentAlerts.length === 0 ? (
              <p className="text-sm text-navy/60">All documents current</p>
            ) : (
              <ul className="space-y-2">
                {data.documentAlerts.slice(0, 3).map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="capitalize text-navy">
                      {doc.document_type.replace("_", " ")}
                    </span>
                    <Link href="/portal/documents">
                      <Button size="sm" variant="outline" className="gap-1">
                        <Upload className="size-3" /> Upload
                      </Button>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {data.externalAlerts.length > 0 && (
        <section>
          <h2 className="mb-4 font-heading text-xl font-semibold text-navy">
            External Alerts
          </h2>
          <div className="space-y-3">
            {data.externalAlerts.map((alert) => (
              <Card
                key={alert.id}
                className="border-amber-200 bg-amber-50/50"
              >
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-3">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
                    <div>
                      <p className="font-medium text-navy capitalize">
                        {alert.intent?.replace("_", " ") ?? alert.channel}
                      </p>
                      <p className="text-sm text-navy/70">
                        {alert.content ?? "Callback requested"}
                      </p>
                      {alert.from_number && (
                        <p className="text-sm text-navy/60">
                          From: {alert.from_number}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {alert.from_number && (
                      <a href={`tel:${alert.from_number}`}>
                        <Button variant="outline" size="sm">
                          Call Back
                        </Button>
                      </a>
                    )}
                    <Button
                      size="sm"
                      className="bg-teal hover:bg-teal-700"
                      onClick={() => router.push("/portal/patients")}
                    >
                      View Patient
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
