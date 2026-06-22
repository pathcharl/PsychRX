"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Activity,
  CalendarDays,
  DollarSign,
  Stethoscope,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/portal/utils";
import type {
  AdminDashboardData,
  PaymentFeedItem,
} from "@/lib/admin/types";
import {
  PIPELINE_STAGES,
  providerTypeLabel,
  sessionStatusColor,
  sessionStatusLabel,
} from "@/lib/admin/utils";

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <Card className="border-navy/10">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-navy/60">{label}</p>
          <Icon className="size-5 text-teal" />
        </div>
        <p className="mt-2 font-heading text-3xl font-bold text-navy">{value}</p>
        {sub && <div className="mt-1 text-xs text-navy/60">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function PaymentFeed({ initial }: { initial: PaymentFeedItem[] }) {
  const [payments, setPayments] = useState<PaymentFeedItem[]>(initial);
  const [flashId, setFlashId] = useState<string | null>(null);
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel("admin-provider-payments")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "provider_payments" },
        async (payload) => {
          const row = payload.new as Record<string, unknown>;
          let name = "Provider";
          if (row.provider_id) {
            const { data } = await supabase
              .from("providers")
              .select("first_name, last_name")
              .eq("id", row.provider_id as string)
              .maybeSingle();
            if (data) {
              name = `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || name;
            }
          }
          const item: PaymentFeedItem = {
            id: row.id as string,
            provider_id: (row.provider_id as string) ?? null,
            provider_name: name,
            provider_amount: Number(row.provider_amount ?? 0),
            session_count: row.session_count != null ? Number(row.session_count) : null,
            created_at: (row.created_at as string) ?? new Date().toISOString(),
            transferred_at: (row.transferred_at as string) ?? null,
          };
          setPayments((prev) => [item, ...prev].slice(0, 10));
          setFlashId(item.id);
          setTimeout(() => setFlashId(null), 2000);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Card className="border-navy/10">
      <CardHeader className="flex-row items-center justify-between border-b border-navy/5 pb-3">
        <CardTitle className="font-heading text-lg text-navy">
          Live Payment Feed
        </CardTitle>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-red-500" />
          </span>
          LIVE
        </span>
      </CardHeader>
      <CardContent className="p-0">
        {payments.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-navy/60">
            Waiting for payments…
          </p>
        ) : (
          <ul className="divide-y divide-navy/5">
            {payments.map((p) => (
              <li
                key={p.id}
                className={cn(
                  "flex items-center justify-between px-5 py-3 transition-colors",
                  flashId === p.id && "animate-pulse bg-emerald-50"
                )}
              >
                <div>
                  <p className="font-medium text-navy">{p.provider_name}</p>
                  <p className="text-xs text-navy/50">
                    {p.session_count != null ? `${p.session_count} sessions · ` : ""}
                    {format(new Date(p.created_at), "MMM d, h:mm a")}
                  </p>
                </div>
                <span className="font-heading font-semibold text-emerald-600">
                  {formatCurrency(p.provider_amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SessionMonitor({ data }: { data: AdminDashboardData["sessions"] }) {
  return (
    <Card className="border-navy/10">
      <CardHeader className="border-b border-navy/5 pb-3">
        <CardTitle className="font-heading text-lg text-navy">
          Session Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {data.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-navy/60">
            No sessions in the next 3 hours.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy/5 text-left text-xs uppercase text-navy/50">
                  <th className="px-5 py-2 font-medium">Time</th>
                  <th className="px-5 py-2 font-medium">Patient</th>
                  <th className="px-5 py-2 font-medium">Provider</th>
                  <th className="px-5 py-2 font-medium">Modality</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr
                    key={s.id}
                    className={cn(
                      "border-b border-navy/5 last:border-0",
                      s.status === "no_show" && "bg-red-50"
                    )}
                  >
                    <td className="px-5 py-3 text-navy">
                      {format(new Date(s.start_time), "h:mm a")}
                    </td>
                    <td className="px-5 py-3 text-navy">{s.patient_name}</td>
                    <td className="px-5 py-3 text-navy/70">{s.provider_name}</td>
                    <td className="px-5 py-3 capitalize text-navy/70">
                      {s.modality}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          sessionStatusColor(s.status)
                        )}
                      >
                        {sessionStatusLabel(s.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PipelineKanban({ data }: { data: AdminDashboardData["pipeline"] }) {
  return (
    <Card className="border-navy/10">
      <CardHeader className="border-b border-navy/5 pb-3">
        <CardTitle className="font-heading text-lg text-navy">
          Provider Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {PIPELINE_STAGES.map((stage) => {
            const providers = data.filter((p) => p.stage === stage.id);
            return (
              <div key={stage.id} className="rounded-lg bg-psych-bg p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-navy/60">
                    {stage.label}
                  </p>
                  <span className="rounded-full bg-navy/10 px-2 text-xs text-navy/70">
                    {providers.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {providers.map((p) => (
                    <div
                      key={p.id}
                      className={cn(
                        "rounded-lg border bg-white p-2.5 text-sm shadow-sm",
                        p.stuck ? "border-amber-300 bg-amber-50" : "border-navy/10"
                      )}
                    >
                      <p className="font-medium text-navy">{p.name}</p>
                      <p className="text-xs text-navy/50">
                        {providerTypeLabel(p.provider_type)}
                        {p.stuck && ` · ${p.days_in_stage}d stuck`}
                      </p>
                    </div>
                  ))}
                  {providers.length === 0 && (
                    <p className="px-1 py-2 text-xs text-navy/40">None</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminDashboardClient({ data }: { data: AdminDashboardData }) {
  const { metrics, billing, campaign } = data;
  const typeBreakdown = Object.entries(metrics.providersByType)
    .map(([type, count]) => `${providerTypeLabel(type)}: ${count}`)
    .join(" · ");

  const faxPct =
    campaign.dailyFaxLimit > 0
      ? Math.round((campaign.faxesSentToday / campaign.dailyFaxLimit) * 100)
      : 0;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-navy/70">Real-time platform overview</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Stethoscope}
          label="Active Providers"
          value={String(metrics.activeProviders)}
          sub={typeBreakdown || "No breakdown"}
        />
        <MetricCard
          icon={Users}
          label="Active Patients"
          value={String(metrics.activePatients)}
        />
        <MetricCard
          icon={CalendarDays}
          label="Sessions This Week"
          value={String(metrics.sessionsThisWeek)}
        />
        <MetricCard
          icon={DollarSign}
          label="Revenue This Week"
          value={formatCurrency(metrics.revenueThisWeek)}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <PaymentFeed initial={data.recentPayments} />
        <SessionMonitor data={data.sessions} />
      </section>

      <PipelineKanban data={data.pipeline} />

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="border-navy/10">
          <CardHeader className="border-b border-navy/5 pb-3">
            <CardTitle className="font-heading text-lg text-navy">
              Billing Center
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 p-5">
            <div>
              <p className="text-sm text-navy/60">Claims Pending</p>
              <p className="font-heading text-2xl font-bold text-navy">
                {billing.claimsPending}
              </p>
            </div>
            <div>
              <p className="text-sm text-navy/60">Paid This Month</p>
              <p className="font-heading text-2xl font-bold text-emerald-600">
                {formatCurrency(billing.claimsPaidThisMonth)}
              </p>
            </div>
            <div>
              <p className="text-sm text-navy/60">Denial Rate</p>
              <p className="font-heading text-2xl font-bold text-navy">
                {billing.denialRate}%
              </p>
            </div>
            <div>
              <p className="text-sm text-navy/60">Avg Days to Payment</p>
              <p className="font-heading text-2xl font-bold text-navy">
                {billing.avgDaysToPayment}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-navy/10">
          <CardHeader className="border-b border-navy/5 pb-3">
            <CardTitle className="font-heading text-lg text-navy">
              Campaign Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-navy/60">Faxes Sent Today</span>
                <span className="font-medium text-navy">
                  {campaign.faxesSentToday} / {campaign.dailyFaxLimit}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-navy/10">
                <div
                  className="h-full bg-teal transition-all"
                  style={{ width: `${Math.min(100, faxPct)}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-navy/60">Referral Sources (month)</span>
              <Badge variant="outline">{campaign.referralSourcesContacted}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-navy/60">Provider Recruits (month)</span>
              <Badge variant="outline">{campaign.providerRecruitsContacted}</Badge>
            </div>
            <div>
              <p className="mb-1 text-sm text-navy/60">Allocation Split</p>
              <div className="flex h-3 w-full overflow-hidden rounded-full">
                <div
                  className="bg-teal"
                  style={{ width: `${campaign.allocationReferralPct}%` }}
                  title={`Referral ${campaign.allocationReferralPct}%`}
                />
                <div
                  className="bg-navy"
                  style={{ width: `${campaign.allocationRecruitPct}%` }}
                  title={`Recruit ${campaign.allocationRecruitPct}%`}
                />
              </div>
              <div className="mt-1 flex justify-between text-xs text-navy/50">
                <span>Referral {campaign.allocationReferralPct}%</span>
                <span>Recruit {campaign.allocationRecruitPct}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
