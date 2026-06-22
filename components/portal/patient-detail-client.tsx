"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import {
  Calendar,
  MessageSquare,
  PenLine,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Phq9Point, PortalMessage, SessionHistoryRow } from "@/lib/portal/types";
import { cptLabel, formatCurrency, formatDate, formatTime } from "@/lib/portal/utils";

interface PatientDetailProps {
  patient: Record<string, unknown>;
  providerId: string;
  sessionCount: number;
  upcoming: Array<Record<string, unknown>>;
  sessionHistory: SessionHistoryRow[];
  phq9Trend: Phq9Point[];
  messages: PortalMessage[];
  lastPhq9: number | null;
}

export function PatientDetailClient({
  patient,
  providerId,
  sessionCount,
  upcoming,
  sessionHistory,
  phq9Trend,
  messages,
  lastPhq9,
}: PatientDetailProps) {
  const router = useRouter();
  const [referring, setReferring] = useState(false);
  const patientId = patient.id as string;
  const firstName = patient.first_name as string;
  const lastName = patient.last_name as string;

  async function handleReferral(careType: string) {
    setReferring(true);
    try {
      const res = await fetch("/api/portal/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          provider_id: providerId,
          referral_type: careType,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Referral to ${careType} submitted.`);
    } catch {
      toast.error("Could not submit referral.");
    } finally {
      setReferring(false);
    }
  }

  async function cancelAppointment(appointmentId: string) {
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Appointment cancelled.");
      router.refresh();
    } catch {
      toast.error("Could not cancel appointment.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-navy">
            {firstName} {lastName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-navy/70">
            {(patient.dob as string | null) && (
              <span>DOB: {formatDate(patient.dob as string)}</span>
            )}
            {(patient.dob as string | null) && <span>·</span>}
            <span>{(patient.insurance_payer as string) ?? "Self-pay"}</span>
            <Badge
              variant="outline"
              className={
                patient.insurance_verified
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }
            >
              {patient.insurance_verified ? "Verified" : "Unverified"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/portal/schedule">
            <Button variant="outline" className="gap-2">
              <Calendar className="size-4" /> Schedule New
            </Button>
          </Link>
          <Link href="/portal/scribe">
            <Button variant="outline" className="gap-2">
              <PenLine className="size-4" /> Submit Note
            </Button>
          </Link>
          <Link href="/portal/messages">
            <Button className="gap-2 bg-teal hover:bg-teal-700">
              <MessageSquare className="size-4" /> Message Patient
            </Button>
          </Link>
        </div>
      </div>

      <Card className="border-navy/10">
        <CardHeader>
          <CardTitle className="font-heading text-lg text-navy">
            Care Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-navy/60">Primary diagnosis</p>
            <p className="font-medium text-navy">
              {(patient.primary_diagnosis as string) ?? "Not documented"}
            </p>
          </div>
          <div>
            <p className="text-sm text-navy/60">Treatment start</p>
            <p className="font-medium text-navy">
              {patient.created_at
                ? formatDate(patient.created_at as string)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-navy/60">Total sessions</p>
            <p className="font-medium text-navy">{sessionCount}</p>
          </div>
          <div>
            <p className="text-sm text-navy/60">Last PHQ-9</p>
            <p className="font-medium text-navy">
              {lastPhq9 != null ? `${lastPhq9}/27` : "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      {phq9Trend.length > 1 && (
        <Card className="border-navy/10">
          <CardHeader>
            <CardTitle className="font-heading text-lg text-navy">
              PHQ-9 Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={phq9Trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fill: "#1B2B4B", fontSize: 12 }} />
                  <YAxis domain={[0, 27]} tick={{ fill: "#1B2B4B", fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#0D9488"
                    strokeWidth={2}
                    dot={{ fill: "#0D9488" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-navy/10">
        <CardHeader>
          <CardTitle className="font-heading text-lg text-navy">
            Upcoming Appointments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-navy/60">No upcoming appointments.</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((appt) => (
                <div
                  key={appt.id as string}
                  className="flex flex-col gap-2 rounded-lg border border-navy/10 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-navy">
                      {formatDate(appt.start_time as string)} at{" "}
                      {formatTime(appt.start_time as string)}
                    </p>
                    <p className="text-sm text-navy/60 capitalize">
                      {(appt.appointment_type as string)?.replace("_", " ")} ·{" "}
                      {appt.session_modality as string}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Reschedule
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cancelAppointment(appt.id as string)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-navy/10">
        <CardHeader>
          <CardTitle className="font-heading text-lg text-navy">
            Session History
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>CPT</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Claim Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessionHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-navy/60">
                    No session history yet.
                  </TableCell>
                </TableRow>
              ) : (
                sessionHistory.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatDate(row.date_of_service)}</TableCell>
                    <TableCell>
                      {cptLabel(row.cpt_code)}
                      <span className="ml-1 text-navy/50">({row.cpt_code})</span>
                    </TableCell>
                    <TableCell>{formatCurrency(row.charge_amount)}</TableCell>
                    <TableCell className="capitalize">{row.claim_status}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-navy/10">
        <CardHeader>
          <CardTitle className="font-heading text-lg text-navy">
            Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <p className="text-sm text-navy/60">No messages yet.</p>
          ) : (
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg p-3 text-sm ${
                    msg.sender_type === "provider"
                      ? "ml-8 bg-teal/10 text-navy"
                      : "mr-8 bg-navy/5 text-navy"
                  }`}
                >
                  <p>{msg.content}</p>
                  <p className="mt-1 text-xs text-navy/50">
                    {formatDate(msg.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-navy/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-lg text-navy">
            <UserPlus className="size-5" /> Internal Referral
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={referring}
            onClick={() => handleReferral("medication management")}
          >
            Refer to medication management
          </Button>
          <Button
            variant="outline"
            disabled={referring}
            onClick={() => handleReferral("therapy")}
          >
            Refer to therapy
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
