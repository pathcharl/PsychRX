import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid } from "date-fns";

/** Merge Tailwind class names safely. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a phone number for display.
 * Accepts raw digits, E.164 (+1XXXXXXXXXX), or already-formatted input.
 * Returns "(XXX) XXX-XXXX" for US numbers, or the cleaned input otherwise.
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length === 10) {
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }
  return phone.trim();
}

/** Normalize a phone number to E.164 (defaults to US +1). Returns "" if invalid. */
export function toE164(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.trim().startsWith("+")) return `+${digits}`;
  return "";
}

/**
 * Format a date (Date | ISO string | YYYY-MM-DD) using a date-fns pattern.
 * Defaults to "MMM d, yyyy". Returns "" for invalid input.
 */
export function formatDate(
  value: Date | string | null | undefined,
  pattern = "MMM d, yyyy"
): string {
  if (!value) return "";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (!isValid(date)) return "";
  return format(date, pattern);
}

/** Format a date with time, e.g. "Mar 4, 2026 2:30 PM". */
export function formatDateTime(
  value: Date | string | null | undefined,
  pattern = "MMM d, yyyy h:mm a"
): string {
  return formatDate(value, pattern);
}

/** Format a numeric amount as USD currency. */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency = "USD"
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (num == null || Number.isNaN(num)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(num);
}

/**
 * Generate a cryptographically-random URL-safe token.
 * Works in both Node (18+) and the browser via the Web Crypto API.
 * @param length number of random bytes (default 32 -> 64 hex chars)
 */
export function generateToken(length = 32): string {
  const bytes = new Uint8Array(length);
  const cryptoObj: Crypto | undefined =
    typeof globalThis !== "undefined" ? (globalThis.crypto as Crypto) : undefined;

  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compute age in years from a date of birth (Date | ISO string). */
export function calculateAge(dob: Date | string | null | undefined): number | null {
  if (!dob) return null;
  const date = typeof dob === "string" ? parseISO(dob) : dob;
  if (!isValid(date)) return null;
  const diff = Date.now() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}
