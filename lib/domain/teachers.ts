// lib/domain/teachers.ts

import type {
  TeacherStatus,
  TeacherInvoiceStatus,
} from "@/lib/types/teachers";
import { formatPenniesAsPounds } from "@/lib/formatters";

// ---------------------------------------------------------------------------
// Teacher status helpers
// ---------------------------------------------------------------------------

export type TeacherStatusMeta = {
  label: string;
  className: string;
};

/**
 * Map a teacher status value to a human-friendly label + Tailwind classes
 * for a badge. Keep this in sync with admin UI copy.
 */
export function getTeacherStatusMeta(
  status: TeacherStatus | string,
): TeacherStatusMeta {
  switch (status) {
    case "current":
      return {
        label: "Current teacher",
        className: "bg-emerald-50 text-emerald-700",
      };
    case "inactive":
      return {
        label: "Inactive (only dormant students)",
        className: "bg-amber-50 text-amber-700",
      };
    case "potential":
      return {
        label: "Potential (no current/dormant students)",
        className: "bg-slate-50 text-slate-700",
      };
    case "past":
      return {
        label: "Past teacher",
        className: "bg-rose-50 text-rose-700",
      };
    default:
      // Fallback for unexpected values
      return {
        label: status,
        className: "bg-slate-50 text-slate-700",
      };
  }
}

/**
 * Convenience alias when you only need the label, not the styling.
 */
export function formatTeacherStatus(
  status: TeacherStatus | string,
): string {
  return getTeacherStatusMeta(status).label;
}

// ---------------------------------------------------------------------------
// Teacher invoice helpers
// ---------------------------------------------------------------------------

export type TeacherInvoiceStatusMeta = {
  label: string;
  className: string;
};

/**
 * Canonical mapping from a teacher invoice status to:
 * - a human-friendly label
 * - Tailwind classes for a badge/chip
 *
 * Shared between admin + teacher invoice UIs.
 *
 * Status values come from the DB enum via InvoiceStatus:
 *   - "not_generated"
 *   - "generated"
 *   - "paid"
 */
export function getTeacherInvoiceStatusMeta(
  status: TeacherInvoiceStatus | string,
): TeacherInvoiceStatusMeta {
  switch (status) {
    case "not_generated":
      return {
        label: "Not generated",
        className: "bg-slate-50 text-slate-700",
      };
    case "generated":
      return {
        label: "Awaiting payment",
        className: "bg-amber-50 text-amber-700",
      };
    case "paid":
      return {
        label: "Paid",
        className: "bg-emerald-50 text-emerald-700",
      };
    default:
      // Fallback for unexpected values (defensive only)
      return {
        label: String(status),
        className: "bg-slate-50 text-slate-700",
      };
  }
}

/**
 * Convenience alias when you only need the invoice status label.
 */
export function formatTeacherInvoiceStatus(
  status: TeacherInvoiceStatus | string,
): string {
  return getTeacherInvoiceStatusMeta(status).label;
}

// ---------------------------------------------------------------------------
// Money / rate helpers
// ---------------------------------------------------------------------------

/**
 * Format a raw pennies value as a £ string (no "/h" suffix).
 * Returns "—" for null/undefined.
 *
 * DB convention: store pennies; UI displays as pounds via helpers.
 */
export function formatTeacherMoney(
  pennies: number | null | undefined,
): string {
  if (pennies == null) return "—";
  return formatPenniesAsPounds(pennies);
}

/**
 * Format a raw pennies value as "£X.XX/h".
 * Returns "—" for null/undefined.
 */
export function formatTeacherHourlyRate(
  pennies: number | null | undefined,
): string {
  if (pennies == null) return "—";
  return `${formatPenniesAsPounds(pennies)}/h`;
}
