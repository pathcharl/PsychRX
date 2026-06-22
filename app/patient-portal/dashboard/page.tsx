import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { NextAppointmentCard } from "@/components/patient-portal/next-appointment-card";
import {
  CareTeamCard,
  QuickActions,
} from "@/components/patient-portal/portal-sections";
import { MessagePreview } from "@/components/patient-portal/messages-client";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requirePortalPatient } from "@/lib/patient-portal/auth";
import { fetchDashboardData } from "@/lib/patient-portal/data";
import { formatCurrency } from "@/lib/patient-portal/utils";

export default async function PatientPortalDashboardPage() {
  const ctx = await requirePortalPatient();
  if (!ctx) return null;

  const { patient } = ctx;
  const data = await fetchDashboardData(patient);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">
          Welcome back, {patient.first_name}
        </h1>
        <p className="mt-1 text-navy/70">Your care at a glance</p>
      </div>

      {data.nextAppointment ? (
        <NextAppointmentCard
          appointment={data.nextAppointment}
          patientPhone={patient.phone}
        />
      ) : (
        <Card className="border-navy/10 bg-white">
          <CardContent className="py-10 text-center">
            <p className="text-navy/70">No upcoming appointments scheduled.</p>
            <Link
              href="/schedule"
              className={buttonVariants({ className: "mt-4 bg-teal hover:bg-teal-700" })}
            >
              Schedule an appointment
            </Link>
          </CardContent>
        </Card>
      )}

      {data.questionnaireDue && (
        <div className="flex flex-col gap-4 rounded-xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <ClipboardList className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-medium text-amber-950">
                Your provider has requested a brief questionnaire. It takes 2
                minutes.
              </p>
            </div>
          </div>
          <Link
            href="/patient-portal/questionnaire"
            className={buttonVariants({
              className: "shrink-0 bg-amber-600 hover:bg-amber-700",
            })}
          >
            Take questionnaire
          </Link>
        </div>
      )}

      {data.careTeam.length > 0 && (
        <section>
          <h2 className="mb-4 font-heading text-xl font-semibold text-navy">
            My Care Team
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.careTeam.map((provider) => (
              <CareTeamCard key={provider.id} provider={provider} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-xl font-semibold text-navy">
              Recent Messages
            </h2>
            <Link
              href="/patient-portal/messages"
              className="text-sm font-medium text-teal hover:underline"
            >
              View All
            </Link>
          </div>
          {data.recentMessages.length === 0 ? (
            <p className="text-sm text-navy/60">No messages yet.</p>
          ) : (
            <div className="space-y-3">
              {data.recentMessages.map((msg) => (
                <MessagePreview key={msg.id} message={msg} />
              ))}
            </div>
          )}
        </div>

        <Card className="border-navy/10 bg-white">
          <CardHeader>
            <CardTitle className="font-heading text-xl text-navy">
              Billing Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-navy/10 pb-2">
              <span className="text-navy/70">Insurance</span>
              <span className="font-medium text-navy">{data.billing.payer}</span>
            </div>
            <div className="flex justify-between border-b border-navy/10 pb-2">
              <span className="text-navy/70">Copay</span>
              <span className="font-medium text-navy">
                {formatCurrency(data.billing.copay)}
              </span>
            </div>
            {data.billing.outstandingBalance != null &&
              data.billing.outstandingBalance > 0 && (
                <div className="flex justify-between">
                  <span className="text-navy/70">Outstanding balance</span>
                  <span className="font-semibold text-amber-700">
                    {formatCurrency(data.billing.outstandingBalance)}
                  </span>
                </div>
              )}
            <Link
              href="/patient-portal/billing"
              className={buttonVariants({ variant: "outline", size: "sm", className: "mt-2" })}
            >
              View billing
            </Link>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-4 font-heading text-xl font-semibold text-navy">
          Quick Actions
        </h2>
        <QuickActions />
      </section>
    </div>
  );
}
