// lib/formatters.ts
import type { Delivery } from "@/lib/enums";

// --- Minutes / hours --------------------------------------------------------

export function formatMinutesAsHours(mins: number | null | undefined): string {
  if (!mins && mins !== 0) return "—";
  return (mins / 60).toFixed(2); // numeric only
}

export function formatHoursLabel(mins: number | null | undefined): string {
  if (!mins && mins !== 0) return "—";
  return `${(mins / 60).toFixed(2)} h`; // with unit
}

// --- Delivery labels -------------------------------------------------------

export function formatDeliveryLabel(d: Delivery | null): string {
  if (!d) return "—";
  if (d === "online") return "Online";
  if (d === "f2f") return "Face to face";
  return d;
}

// --- Money (pennies ↔ pounds) ----------------------------------------------

export function formatPenniesAsPoundsPerHour(
  pennies: number | null | undefined,
): string {
  if (!pennies && pennies !== 0) return "—";
  return `£${(pennies / 100).toFixed(2)}/hr`;
}

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

/**
 * General money formatter for pennies → "£X.YY"
 */
export function formatMoneyFromPennies(pennies: number): string {
  return GBP.format(pennies / 100);
}

/**
 * Simple pennies → "£X.YY" (string) helper.
 * Treats null/undefined as £0.00.
 */
export function formatPenniesAsPounds(
  value: number | null | undefined,
): string {
  const pennies = value ?? 0;
  const pounds = pennies / 100;
  return `£${pounds.toFixed(2)}`;
}

// --- Date / time helpers ----------------------------------------------------

function ensureDate(input: string | Date): Date {
  return typeof input === "string" ? new Date(input) : input;
}

/**
 * Generic date formatter for an arbitrary IANA time zone.
 * Falls back to Europe/London if timeZone is null/undefined.
 */
export function formatDateInZone(
  isoUtc: string | Date,
  timeZone: string | null | undefined,
): string {
  const d = ensureDate(isoUtc);
  const tz = timeZone || "Europe/London";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(d)
    .replace(/\//g, ".");
}

/**
 * Generic time formatter for an arbitrary IANA time zone.
 * Falls back to Europe/London if timeZone is null/undefined.
 */
export function formatTimeInZone(
  isoUtc: string | Date,
  timeZone: string | null | undefined,
): string {
  const d = ensureDate(isoUtc);
  const tz = timeZone || "Europe/London";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Generic date+time formatter for an arbitrary IANA time zone.
 * Falls back to Europe/London if timeZone is null/undefined.
 */
export function formatDateTimeInZone(
  isoUtc: string | Date,
  timeZone: string | null | undefined,
): string {
  return `${formatDateInZone(isoUtc, timeZone)} · ${formatTimeInZone(
    isoUtc,
    timeZone,
  )}`;
}

// --- Date / time (Europe/London) -------------------------------------------

export function formatDateLondon(isoUtc: string | Date): string {
  // Legacy helper kept for backwards compatibility.
  return formatDateInZone(isoUtc, "Europe/London");
}

export function formatTimeLondon(isoUtc: string | Date): string {
  // Legacy helper kept for backwards compatibility.
  return formatTimeInZone(isoUtc, "Europe/London");
}

export function formatDateTimeLondon(isoUtc: string | Date): string {
  // Legacy helper kept for backwards compatibility.
  return `${formatDateLondon(isoUtc)} · ${formatTimeLondon(isoUtc)}`;
}

// Alias used elsewhere
export const formatDateTimeUK = formatDateTimeLondon;

// --- Role-oriented time helpers --------------------------------------------

/**
 * Student-facing date+time: uses the student's local time zone if provided,
 * otherwise falls back to Europe/London.
 */
export function formatStudentDateTime(
  isoUtc: string | Date,
  studentTimeZone: string | null | undefined,
): string {
  return formatDateTimeInZone(isoUtc, studentTimeZone);
}

/**
 * Teacher-facing date+time: uses the teacher's local time zone if provided,
 * otherwise falls back to Europe/London.
 *
 * You can opt-in to this in teacher UIs later; admin/ops can continue to use
 * formatDateTimeLondon for a London-centric view.
 */
export function formatTeacherDateTime(
  isoUtc: string | Date,
  teacherTimeZone: string | null | undefined,
): string {
  return formatDateTimeInZone(isoUtc, teacherTimeZone);
}

// --- London month-start helpers --------------------------------------------

/**
 * Get the first day of the month (YYYY-MM-01) for the given date
 * in Europe/London time.
 */
export function getLondonMonthStartISO(date: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
  });

  const parts = fmt.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;

  if (!year || !month) {
    throw new Error("Could not determine Europe/London month start");
  }

  // YYYY-MM-01
  return `${year}-${month}-01`;
}

export function getCurrentLondonMonthStartISO(): string {
  return getLondonMonthStartISO(new Date());
}

// --- Percent helpers (for analytics / margins) ------------------------------

/**
 * Format a percentage value (e.g. 12.345 -> "12.3%").
 * Returns "—" for null/undefined/NaN.
 */
export function formatPercent(
  value: number | null | undefined,
  decimals: number = 1,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(decimals)}%`;
}
