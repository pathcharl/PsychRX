import type { PipelineStage, SessionMonitorStatus } from "./types";

export const PIPELINE_STAGES: { id: PipelineStage; label: string }[] = [
  { id: "applied", label: "Applied" },
  { id: "documents", label: "Documents Under Review" },
  { id: "contract", label: "Contract Sent" },
  { id: "stripe", label: "Stripe Setup" },
  { id: "active", label: "Active" },
];

export const PROVIDER_TYPE_LABELS: Record<string, string> = {
  pmhnp: "PMHNP",
  therapist: "Therapist",
  psychologist: "Psychologist",
  psychiatrist: "Psychiatrist",
  md_supervisor: "MD Supervisor",
};

export function providerTypeLabel(type: string | null): string {
  if (!type) return "—";
  return PROVIDER_TYPE_LABELS[type] ?? type;
}

export function sessionStatusColor(status: SessionMonitorStatus): string {
  switch (status) {
    case "in_progress":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "completed":
      return "bg-navy/5 text-navy/60 border-navy/10";
    case "no_show":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-blue-100 text-blue-800 border-blue-200";
  }
}

export function sessionStatusLabel(status: SessionMonitorStatus): string {
  switch (status) {
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "no_show":
      return "No-Show";
    default:
      return "Upcoming";
  }
}

/**
 * Providers store fill_rate as a 0..1 fraction (numeric(4,3)). The UI works in
 * whole percentages, so convert fractions up while leaving values already in
 * percent form (legacy/edge rows > 1) untouched.
 */
export function toFillPercent(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

export function fillRateColor(rate: number): string {
  if (rate >= 80) return "text-emerald-600";
  if (rate >= 60) return "text-amber-600";
  return "text-red-600";
}

export function fillRateStroke(rate: number): string {
  if (rate >= 80) return "#059669";
  if (rate >= 60) return "#d97706";
  return "#dc2626";
}

export function expiryColor(daysUntil: number | null): string {
  if (daysUntil == null) return "bg-navy/5 text-navy/50 border-navy/10";
  if (daysUntil < 0) return "bg-red-100 text-red-800 border-red-200";
  if (daysUntil < 30) return "bg-red-100 text-red-800 border-red-200";
  if (daysUntil <= 60) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-emerald-100 text-emerald-800 border-emerald-200";
}

export function urgencyColor(urgency: string): string {
  switch (urgency.toLowerCase()) {
    case "high":
    case "critical":
      return "bg-red-100 text-red-800 border-red-200";
    case "medium":
    case "moderate":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
}

export function statusBadgeColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "inactive":
    case "suspended":
      return "bg-red-100 text-red-800 border-red-200";
    case "pending":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-navy/5 text-navy/60 border-navy/10";
  }
}
