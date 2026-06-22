"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AdminPatientRow } from "@/lib/admin/types";
import { statusBadgeColor } from "@/lib/admin/utils";

export function PatientsClient({ rows }: { rows: AdminPatientRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((p) =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(term)
    );
  }, [rows, search]);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">Patients</h1>
        <p className="mt-1 text-navy/70">
          {filtered.length} of {rows.length} shown
        </p>
      </div>

      <Card className="border-navy/10">
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-navy/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patients"
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-navy/10">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy/10 text-left text-xs uppercase text-navy/50">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Insurance</th>
                  <th className="px-4 py-3 font-medium">Care Type</th>
                  <th className="px-4 py-3 font-medium">Primary Provider</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-navy/5 last:border-0">
                    <td className="px-4 py-3 font-medium text-navy">
                      {p.first_name} {p.last_name}
                    </td>
                    <td className="px-4 py-3 text-navy/70">
                      {p.insurance_payer ?? "Self-pay"}
                    </td>
                    <td className="px-4 py-3 capitalize text-navy/70">
                      {p.care_type?.replace("_", " ") ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-navy/70">
                      {p.primary_provider ?? "Unassigned"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
                          statusBadgeColor(p.status)
                        )}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-navy/50">
                      No patients found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
