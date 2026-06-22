import { format, nextFriday, parseISO, isFriday, addWeeks } from "date-fns";

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatTime(iso: string): string {
  try {
    return format(parseISO(iso), "h:mm a");
  } catch {
    return iso;
  }
}

export function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

export function patientDisplayName(first: string, last: string): string {
  const initial = last?.charAt(0)?.toUpperCase() ?? "";
  return `${first} ${initial}.`;
}

export function celebrationEmoji(level: string | null): string {
  switch (level) {
    case "good":
      return "🎉";
    case "great":
      return "🚀";
    case "milestone":
      return "🏆";
    default:
      return "💰";
  }
}

export function fillRateColor(rate: number): string {
  if (rate >= 80) return "text-emerald-600";
  if (rate >= 60) return "text-amber-600";
  return "text-red-600";
}

export function fillRateBg(rate: number): string {
  if (rate >= 80) return "bg-emerald-500";
  if (rate >= 60) return "bg-amber-500";
  return "bg-red-500";
}

export function noShowRiskColor(risk: string | null): string {
  switch (risk) {
    case "high":
      return "bg-red-100 text-red-800 border-red-200";
    case "medium":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
}

export function documentStatusColor(
  daysUntil: number | null
): "green" | "yellow" | "red" | "grey" {
  if (daysUntil == null) return "grey";
  if (daysUntil < 0) return "grey";
  if (daysUntil < 14) return "red";
  if (daysUntil <= 60) return "yellow";
  return "green";
}

export function daysUntilExpiry(expiry: string | null): number | null {
  if (!expiry) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = parseISO(expiry);
  exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function nextPaymentFriday(): string {
  const today = new Date();
  let friday = isFriday(today) ? today : nextFriday(today);
  if (today.getDay() === 5 && today.getHours() >= 17) {
    friday = nextFriday(addWeeks(today, 1));
  }
  return format(friday, "MMM d, yyyy");
}

export function canJoinSession(startTime: string): boolean {
  const start = parseISO(startTime).getTime();
  const now = Date.now();
  const fifteenMin = 15 * 60 * 1000;
  return now >= start - fifteenMin && now <= start + 60 * 60 * 1000;
}

export function cptLabel(code: string): string {
  const map: Record<string, string> = {
    "90791": "Psychiatric diagnostic evaluation",
    "90792": "Psychiatric diagnostic evaluation with medical services",
    "90832": "Psychotherapy, 30 min",
    "90834": "Psychotherapy, 45 min",
    "90837": "Psychotherapy, 60 min",
    "99213": "Office visit, established patient",
    "99214": "Office visit, established patient (moderate)",
    "99215": "Office visit, established patient (high)",
  };
  return map[code] ?? code;
}

export const DOCUMENT_TYPES = [
  { type: "license", label: "Professional License" },
  { type: "malpractice", label: "Malpractice Insurance" },
  { type: "dea", label: "DEA Certificate" },
  { type: "w9", label: "W-9 Form" },
  { type: "caqh", label: "CAQH Profile" },
  { type: "collaborative_agreement", label: "Collaborative Agreement" },
  { type: "contract", label: "Independent Contractor Agreement" },
  { type: "baa", label: "Business Associate Agreement" },
] as const;

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
