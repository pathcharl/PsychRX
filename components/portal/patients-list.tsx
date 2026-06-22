"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PortalPatientSummary } from "@/lib/portal/types";
import { formatDate, noShowRiskColor } from "@/lib/portal/utils";

interface PatientsListProps {
  initialPatients: PortalPatientSummary[];
}

export function PatientsList({ initialPatients }: PatientsListProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "active" | "no_upcoming" | "high_risk"
  >("all");

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return initialPatients.filter((p) => {
      if (filter === "high_risk" && p.no_show_risk !== "high") return false;
      if (filter === "no_upcoming" && p.next_appointment) return false;
      if (term) {
        const name = `${p.first_name} ${p.last_name}`.toLowerCase();
        if (
          !name.includes(term) &&
          !(p.insurance_payer?.toLowerCase().includes(term) ?? false)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [initialPatients, search, filter]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">
          My Patients
        </h1>
        <p className="mt-1 text-navy/70">
          {initialPatients.length} patients in your panel
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy/40" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or insurance..."
          className="pl-10"
        />
      </div>

      <Tabs
        value={filter}
        onValueChange={(v) =>
          setFilter(v as "all" | "active" | "no_upcoming" | "high_risk")
        }
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="no_upcoming">No Upcoming</TabsTrigger>
          <TabsTrigger value="high_risk">High Risk</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((patient) => (
          <Link key={patient.id} href={`/portal/patients/${patient.id}`}>
            <Card className="h-full border-navy/10 transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-heading text-lg font-semibold text-navy">
                    {patient.first_name} {patient.last_name}
                  </p>
                  <Badge
                    variant="outline"
                    className={noShowRiskColor(patient.no_show_risk)}
                  >
                    {patient.no_show_risk ?? "low"} risk
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-navy/60">
                  {patient.insurance_payer ?? "Self-pay"}
                </p>
                <p className="mt-1 text-sm text-navy/60">
                  Next:{" "}
                  {patient.next_appointment
                    ? formatDate(patient.next_appointment)
                    : "None scheduled"}
                </p>
                <p className="mt-1 text-sm text-navy/60">
                  {patient.session_count} sessions
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-navy/60">No patients match your filters.</p>
      )}
    </div>
  );
}
