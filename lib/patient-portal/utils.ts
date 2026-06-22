import { format, differenceInMinutes, addMinutes } from "date-fns";

export function getAppointmentTime(raw: Record<string, unknown>): string {
  return (
    (raw.scheduled_at as string) ||
    (raw.scheduled_start as string) ||
    (raw.start_time as string) ||
    new Date().toISOString()
  );
}

export function getSessionModality(raw: Record<string, unknown>): "video" | "phone" {
  const modality = raw.session_modality as string | undefined;
  if (modality === "phone") return "phone";
  if (modality === "video") return "video";
  if (raw.appointment_type === "telehealth") return "video";
  if (raw.location?.toString().toLowerCase().includes("phone")) return "phone";
  return "video";
}

export function getTelehealthLink(
  appointment: Record<string, unknown>,
  provider?: Record<string, unknown> | null
): string | null {
  return (
    (appointment.telehealth_link as string) ||
    (appointment.telehealth_url as string) ||
    (provider?.telehealth_link as string) ||
    null
  );
}

export function formatAppointmentDate(iso: string): string {
  return format(new Date(iso), "EEEE, MMMM d 'at' h:mm a");
}

export function formatMessageTime(iso: string): string {
  return format(new Date(iso), "MMM d, h:mm a");
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/** Join Session activates 15 minutes before scheduled start. */
export function isJoinSessionActive(scheduledAt: string): boolean {
  const start = new Date(scheduledAt);
  const activationTime = addMinutes(start, -15);
  return Date.now() >= activationTime.getTime();
}

export function minutesUntilAppointment(scheduledAt: string): number {
  return differenceInMinutes(new Date(scheduledAt), new Date());
}

export function getCancellationFee(scheduledAt: string): {
  fee: number;
  label: string;
} | null {
  const hours = minutesUntilAppointment(scheduledAt) / 60;
  if (hours < 2) return { fee: 150, label: "$150 late cancellation fee" };
  if (hours < 24) return { fee: 100, label: "$100 cancellation fee" };
  return null;
}

export function buildGoogleCalendarUrl(params: {
  title: string;
  start: string;
  durationMinutes: number;
  description?: string;
  location?: string;
}): string {
  const start = new Date(params.start);
  const end = addMinutes(start, params.durationMinutes);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const query = new URLSearchParams({
    action: "TEMPLATE",
    text: params.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: params.description ?? "",
    location: params.location ?? "",
  });

  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}

export function buildAppleCalendarUrl(params: {
  title: string;
  start: string;
  durationMinutes: number;
  description?: string;
  location?: string;
}): string {
  const start = new Date(params.start);
  const end = addMinutes(start, params.durationMinutes);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PsychRx//Patient Portal//EN",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${params.title}`,
    `DESCRIPTION:${params.description ?? ""}`,
    `LOCATION:${params.location ?? ""}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export function providerDisplayName(provider: {
  first_name: string;
  credentials?: string | null;
}): string {
  const creds = provider.credentials ? `, ${provider.credentials}` : "";
  return `${provider.first_name}${creds}`;
}
