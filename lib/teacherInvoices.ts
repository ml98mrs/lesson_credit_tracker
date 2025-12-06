// lib/teacherInvoices.ts
//
// Domain helpers for teacher invoices.
// - Mostly pure domain helpers (no React, no data fetching).
// - Contains a small UI-flavoured helper (getInvoiceStatusMeta) which
//   returns labels + Tailwind classes for invoice status badges.
//
// If we ever want stricter layering, getInvoiceStatusMeta can be moved
// to lib/domain/teachers.ts and re-exported there.

/**
 * Returns the first day of the *previous calendar month in UTC*
 * as 'YYYY-MM-01'.
 *
 * This is the canonical key for invoice/reporting months.
 * Convention: invoice/reporting months are defined in UTC, not
 * Europe/London local time.
 */
export function getInvoiceMonthKey(): string {
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  return monthStart.toISOString().slice(0, 10); // 'YYYY-MM-01' (UTC)
}

/**
 * Shared status type for teacher invoice workflows.
 * Mirrors DB / view enums: 'not_generated' | 'generated' | 'paid'.
 */
export type InvoiceStatus = "not_generated" | "generated" | "paid";

/**
 * Format a month_start ('YYYY-MM-DD') as "Month YYYY" in en-GB,
 * matching how we display invoice months in teacher/admin portals.
 */
export function formatInvoiceMonthLabel(monthStart: string): string {
  const d = new Date(`${monthStart}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/**
 * Status metadata for UI layers (label + Tailwind classes).
 * Components should call this rather than re-encoding invoice
 * status labels or colours.
 */
export function getInvoiceStatusMeta(status: InvoiceStatus): {
  label: string;
  className: string;
} {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

  if (status === "paid") {
    return {
      label: "Paid",
      className: `${base} bg-green-100 text-green-800`,
    };
  }

  if (status === "generated") {
    return {
      label: "Generated",
      className: `${base} bg-amber-100 text-amber-800`,
    };
  }

  // default: not_generated
  return {
    label: "Not generated",
    className: `${base} bg-gray-100 text-gray-800`,
  };
}
