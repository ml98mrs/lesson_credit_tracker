// lib/formatters.ts (cleaned)

export function formatMinutesAsHours(mins: number | null | undefined): string {
  if (!mins && mins !== 0) return "—";
  return (mins / 60).toFixed(2); // numeric only
}

export function formatHoursLabel(mins: number | null | undefined): string {
  if (!mins && mins !== 0) return "—";
  return `${(mins / 60).toFixed(2)} h`; // with unit
}

export function formatPenniesAsPoundsPerHour(pennies: number | null | undefined): string {
  if (!pennies && pennies !== 0) return "—";
  return `£${(pennies / 100).toFixed(2)}/hr`;
}

const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
export function formatMoneyFromPennies(pennies: number): string {
  return GBP.format(pennies / 100);
}

// --- Unified date/time section ---

export function formatDateLondon(isoUtc: string | Date): string {
  const d = typeof isoUtc === "string" ? new Date(isoUtc) : isoUtc;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(d)
    .replace(/\//g, ".");
}

export function formatTimeLondon(isoUtc: string | Date): string {
  const d = typeof isoUtc === "string" ? new Date(isoUtc) : isoUtc;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDateTimeLondon(isoUtc: string | Date): string {
  return `${formatDateLondon(isoUtc)} · ${formatTimeLondon(isoUtc)}`;
}
export const formatDateTimeUK = formatDateTimeLondon;

// NEW: London month-start helpers
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
export function formatPenniesAsPounds(value: number | null | undefined): string {
  const pennies = value ?? 0;
  const pounds = pennies / 100;
  return `£${pounds.toFixed(2)}`;
}
