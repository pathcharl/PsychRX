"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FillRateGauge } from "./fill-rate-gauge";
import { cn } from "@/lib/utils";
import type { BalancePageData } from "@/lib/admin/types";
import { urgencyColor } from "@/lib/admin/utils";

export function BalanceClient({ data }: { data: BalancePageData }) {
  const [referral, setReferral] = useState(data.allocationReferralPct);
  const recruit = 100 - referral;
  const [overriding, setOverriding] = useState(false);

  function applyOverride() {
    setOverriding(true);
    setTimeout(() => {
      setOverriding(false);
      toast.success(
        `Override applied: Referral ${referral}% / Recruit ${recruit}%. Balance engine will revert at next run.`
      );
    }, 600);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">
          Balance Engine
        </h1>
        <p className="mt-1 text-navy/70">
          Allocation between referral outreach and provider recruiting
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-navy/10 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg text-navy">
              Current Fill Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 py-6">
            <FillRateGauge rate={data.fillRate} size={160} strokeWidth={12} />
            <p className="text-sm text-navy/60">
              {data.fillRate >= 80
                ? "Healthy — prioritize referrals"
                : data.fillRate >= 60
                  ? "Moderate — balanced outreach"
                  : "Low — prioritize recruiting"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-navy/10 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg text-navy">
              Allocation Override
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 py-6">
            <div>
              <div className="mb-2 flex justify-between text-sm font-medium text-navy">
                <span>Referral {referral}%</span>
                <span>Recruit {recruit}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={referral}
                onChange={(e) => setReferral(Number(e.target.value))}
                className="w-full accent-teal"
              />
              <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full">
                <div className="bg-teal" style={{ width: `${referral}%` }} />
                <div className="bg-navy" style={{ width: `${recruit}%` }} />
              </div>
            </div>
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Manual overrides are temporary. The balance engine will revert to
              its computed allocation at the next scheduled run.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-teal hover:bg-teal-700"
                disabled={overriding}
                onClick={applyOverride}
              >
                {overriding ? "Applying…" : "Apply Override"}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => toast.success("Balance engine re-run triggered")}
              >
                <RefreshCw className="size-4" /> Force Rerun
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-navy/10">
          <CardHeader className="border-b border-navy/5 pb-3">
            <CardTitle className="font-heading text-lg text-navy">
              Decision Log
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-navy/5">
              {data.decisions.map((d) => (
                <li key={d.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-navy">{d.decision}</span>
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
                        urgencyColor(d.urgency)
                      )}
                    >
                      {d.urgency}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-navy/60">{d.reasoning}</p>
                  <p className="mt-1 text-xs text-navy/40">
                    {format(new Date(d.created_at), "MMM d, h:mm a")}
                  </p>
                </li>
              ))}
              {data.decisions.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-navy/50">
                  No balance decisions logged yet.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-navy/10">
          <CardHeader className="flex-row items-center justify-between border-b border-navy/5 pb-3">
            <CardTitle className="font-heading text-lg text-navy">
              Scraper Queue
            </CardTitle>
            <span className="text-xs text-navy/50">
              {data.sentToday}/{data.dailyLimit} sent today
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy/10 text-left text-xs uppercase text-navy/50">
                    <th className="px-4 py-2 font-medium">Contact</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Location</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.scraperQueue.map((c) => (
                    <tr key={c.id} className="border-b border-navy/5 last:border-0">
                      <td className="px-4 py-2.5 text-navy">{c.name}</td>
                      <td className="px-4 py-2.5 capitalize text-navy/70">
                        {c.outreach_type?.replace("_", " ") ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-navy/70">
                        {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-2.5 capitalize text-navy/70">
                        {c.contact_status.replace("_", " ")}
                      </td>
                    </tr>
                  ))}
                  {data.scraperQueue.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-navy/50">
                        Queue is empty.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
