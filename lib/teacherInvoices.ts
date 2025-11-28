// lib/teacherInvoices.ts
//
// Domain helpers and types for teacher invoices.
// No React imports here – UI lives in components/TeacherInvoiceStatusPill.tsx

/**
 * Shared status type for teacher invoice workflows.
 * Mirrors DB / view enums: 'not_generated' | 'generated' | 'paid'.
 */
export type InvoiceStatus = "not_generated" | "generated" | "paid";

/**
 * For teacher invoices, the "invoice month" is the *previous* calendar month.
 * Example: on 8th December we are looking at November ('YYYY-MM-01').
 */
export function getInvoiceMonthKey(): string {
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  return monthStart.toISOString().slice(0, 10); // 'YYYY-MM-01'
}

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
 * UI components can use this without re-encoding the logic.
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
