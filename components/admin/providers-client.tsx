"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Ban,
  CheckCircle2,
  Download,
  Megaphone,
  MessageSquare,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AdminProviderRow } from "@/lib/admin/types";
import {
  PROVIDER_TYPE_LABELS,
  providerTypeLabel,
  statusBadgeColor,
} from "@/lib/admin/utils";

const US_STATES = ["FL", "GA", "TX", "NY", "CA"];

export function ProvidersClient({ rows }: { rows: AdminProviderRow[] }) {
  const router = useRouter();
  const [providers, setProviders] = useState(rows);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return providers.filter((p) => {
      const name = `${p.first_name} ${p.last_name}`.toLowerCase();
      if (term && !name.includes(term) && !(p.npi ?? "").includes(term))
        return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (typeFilter !== "all" && p.provider_type !== typeFilter) return false;
      if (stateFilter !== "all" && p.license_state !== stateFilter) return false;
      return true;
    });
  }, [providers, search, statusFilter, typeFilter, stateFilter]);

  async function updateStatus(id: string, status: "active" | "inactive") {
    setBusyId(id);
    const prev = providers;
    setProviders((list) =>
      list.map((p) => (p.id === id ? { ...p, status } : p))
    );
    try {
      const res = await fetch(`/api/providers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success(status === "active" ? "Provider activated" : "Provider suspended");
    } catch {
      setProviders(prev);
      toast.error("Could not update provider status");
    } finally {
      setBusyId(null);
    }
  }

  function exportCsv() {
    const header = [
      "Name",
      "Type",
      "NPI",
      "Status",
      "Fill Rate",
      "State",
      "Contract",
      "Stripe",
    ];
    const lines = filtered.map((p) =>
      [
        `${p.first_name} ${p.last_name}`,
        providerTypeLabel(p.provider_type),
        p.npi ?? "",
        p.status,
        p.fill_rate != null ? `${p.fill_rate}%` : "",
        p.license_state ?? "",
        p.contract_signed ? "Signed" : "Pending",
        p.stripe_ready ? "Ready" : "Pending",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "providers.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-navy">
            Providers
          </h1>
          <p className="mt-1 text-navy/70">{filtered.length} of {providers.length} shown</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={exportCsv}>
            <Download className="size-4" /> Export CSV
          </Button>
          <Button
            className="gap-2 bg-teal hover:bg-teal-700"
            onClick={() => toast.success("Announcement composer opened")}
          >
            <Megaphone className="size-4" /> Send Announcement
          </Button>
        </div>
      </div>

      <Card className="border-navy/10">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-navy/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or NPI"
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="inactive">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(PROVIDER_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stateFilter} onValueChange={(v) => v && setStateFilter(v)}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                {US_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">NPI</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Fill Rate</th>
                  <th className="px-4 py-3 font-medium">Contract</th>
                  <th className="px-4 py-3 font-medium">Stripe</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className={cn(
                      "border-b border-navy/5 last:border-0",
                      p.status === "inactive" && "bg-red-50/50"
                    )}
                  >
                    <td className="px-4 py-3 font-medium text-navy">
                      {p.first_name} {p.last_name}
                    </td>
                    <td className="px-4 py-3 text-navy/70">
                      {providerTypeLabel(p.provider_type)}
                    </td>
                    <td className="px-4 py-3 text-navy/70">{p.npi ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
                          statusBadgeColor(p.status)
                        )}
                      >
                        {p.status === "inactive" ? "suspended" : p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-navy/70">
                      {p.fill_rate != null ? `${p.fill_rate}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-navy/70">
                      {p.contract_signed ? "Signed" : "Pending"}
                    </td>
                    <td className="px-4 py-3 text-navy/70">
                      {p.stripe_ready ? "Ready" : "Pending"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/admin/providers/${p.id}`)}
                        >
                          View
                        </Button>
                        {p.status === "active" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === p.id}
                            className="text-red-600 hover:text-red-700"
                            onClick={() => updateStatus(p.id, "inactive")}
                          >
                            <Ban className="size-4" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === p.id}
                            className="text-emerald-600 hover:text-emerald-700"
                            onClick={() => updateStatus(p.id, "active")}
                          >
                            <CheckCircle2 className="size-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toast.success(`Message to ${p.first_name}`)}
                        >
                          <MessageSquare className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-navy/50">
                      No providers match your filters.
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
