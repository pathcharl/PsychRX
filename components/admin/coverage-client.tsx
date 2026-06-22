"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CoveragePageData } from "@/lib/admin/types";
import { statusBadgeColor } from "@/lib/admin/utils";

export function CoverageClient({ data }: { data: CoveragePageData }) {
  const [absentProvider, setAbsentProvider] = useState("");
  const [coverProvider, setCoverProvider] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  function assignCoverage() {
    if (!absentProvider || !coverProvider || !startDate || !endDate) {
      toast.error("Please complete all fields.");
      return;
    }
    if (absentProvider === coverProvider) {
      toast.error("Coverage provider must differ from the absent provider.");
      return;
    }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Coverage assignment submitted.");
      setAbsentProvider("");
      setCoverProvider("");
      setStartDate("");
      setEndDate("");
    }, 600);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">
          Coverage
        </h1>
        <p className="mt-1 text-navy/70">
          Provider absences and coverage assignments
        </p>
      </div>

      <Card className="border-navy/10">
        <CardHeader className="border-b border-navy/5 pb-3">
          <CardTitle className="font-heading text-lg text-navy">
            Active Absences
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy/10 text-left text-xs uppercase text-navy/50">
                  <th className="px-4 py-3 font-medium">Provider</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Start</th>
                  <th className="px-4 py-3 font-medium">End</th>
                  <th className="px-4 py-3 font-medium">Affected</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.absences.map((a) => (
                  <tr key={a.id} className="border-b border-navy/5 last:border-0">
                    <td className="px-4 py-3 font-medium text-navy">
                      {a.provider_name}
                    </td>
                    <td className="px-4 py-3 capitalize text-navy/70">
                      {a.absence_type}
                    </td>
                    <td className="px-4 py-3 text-navy/70">
                      {format(new Date(a.start_date), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-navy/70">
                      {format(new Date(a.end_date), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-navy/70">
                      {a.affected_count} appt{a.affected_count === 1 ? "" : "s"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
                          statusBadgeColor(a.status)
                        )}
                      >
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.absences.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-navy/50">
                      No absences on record.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-navy/10">
          <CardHeader className="border-b border-navy/5 pb-3">
            <CardTitle className="font-heading text-lg text-navy">
              Coverage Decisions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-navy/5">
              {data.coverageDecisions.map((d) => (
                <li key={d.id} className="px-4 py-3 text-sm">
                  <p className="font-medium text-navy">
                    {d.original_provider} → {d.coverage_provider}
                  </p>
                  <p className="text-xs text-navy/60">
                    {d.patients_notified} patients notified · {d.status}
                  </p>
                </li>
              ))}
              {data.coverageDecisions.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-navy/50">
                  No active coverage decisions.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-navy/10">
          <CardHeader className="border-b border-navy/5 pb-3">
            <CardTitle className="font-heading text-lg text-navy">
              Manual Coverage Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <Label>Absent provider</Label>
              <Select
                value={absentProvider}
                onValueChange={(v) => v && setAbsentProvider(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {data.activeProviders.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Coverage provider</Label>
              <Select
                value={coverProvider}
                onValueChange={(v) => v && setCoverProvider(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {data.activeProviders.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cov-start">Start date</Label>
                <Input
                  id="cov-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cov-end">End date</Label>
                <Input
                  id="cov-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <Button
              className="bg-teal hover:bg-teal-700"
              disabled={saving}
              onClick={assignCoverage}
            >
              {saving ? "Assigning…" : "Assign Coverage"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
