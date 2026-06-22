"use client";

import { format } from "date-fns";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { daysUntilExpiry } from "@/lib/portal/utils";
import type { AuditLogRow, ComplianceRow } from "@/lib/admin/types";
import { expiryColor } from "@/lib/admin/utils";

function ExpiryCell({ date }: { date: string | null }) {
  const days = daysUntilExpiry(date);
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
        expiryColor(days)
      )}
    >
      {date ? format(new Date(date), "MMM d, yyyy") : "Not on file"}
    </span>
  );
}

export function ComplianceClient({
  rows,
  auditLog,
}: {
  rows: ComplianceRow[];
  auditLog: AuditLogRow[];
}) {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">
          Compliance
        </h1>
        <p className="mt-1 text-navy/70">
          Provider credentials, OIG status, and audit trail
        </p>
      </div>

      <Card className="border-navy/10">
        <CardHeader className="border-b border-navy/5 pb-3">
          <CardTitle className="font-heading text-lg text-navy">
            Provider Credentials
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy/10 text-left text-xs uppercase text-navy/50">
                  <th className="px-4 py-3 font-medium">Provider</th>
                  <th className="px-4 py-3 font-medium">License</th>
                  <th className="px-4 py-3 font-medium">Malpractice</th>
                  <th className="px-4 py-3 font-medium">DEA</th>
                  <th className="px-4 py-3 font-medium">CAQH Attested</th>
                  <th className="px-4 py-3 font-medium">OIG</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-navy/5 last:border-0">
                    <td className="px-4 py-3 font-medium text-navy">{r.name}</td>
                    <td className="px-4 py-3">
                      <ExpiryCell date={r.license_expiry} />
                    </td>
                    <td className="px-4 py-3">
                      <ExpiryCell date={r.malpractice_expiry} />
                    </td>
                    <td className="px-4 py-3">
                      <ExpiryCell date={r.dea_expiry} />
                    </td>
                    <td className="px-4 py-3 text-navy/70">
                      {r.caqh_last_attested
                        ? format(new Date(r.caqh_last_attested), "MMM d, yyyy")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.oig_excluded ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                          <ShieldAlert className="size-3" /> Excluded
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                          <ShieldCheck className="size-3" /> Clear
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-navy/50">
                      No providers on file.
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
              OIG Check History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-navy/5">
              {rows
                .filter((r) => r.oig_checked_at)
                .slice(0, 10)
                .map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <span className="text-navy">{r.name}</span>
                    <span className="text-navy/60">
                      {format(new Date(r.oig_checked_at!), "MMM d, yyyy")} ·{" "}
                      {r.oig_excluded ? "Excluded" : "Clear"}
                    </span>
                  </li>
                ))}
              {rows.filter((r) => r.oig_checked_at).length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-navy/50">
                  No OIG checks recorded.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-navy/10">
          <CardHeader className="border-b border-navy/5 pb-3">
            <CardTitle className="font-heading text-lg text-navy">
              Audit Log
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              <ul className="divide-y divide-navy/5">
                {auditLog.map((log) => (
                  <li key={log.id} className="px-4 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize text-navy">
                        {log.action} {log.entity_type ?? ""}
                      </span>
                      <span className="text-xs text-navy/50">
                        {format(new Date(log.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-xs text-navy/60">
                      {log.actor_email ?? "System"}
                    </p>
                  </li>
                ))}
                {auditLog.length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-navy/50">
                    No audit entries.
                  </li>
                )}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
