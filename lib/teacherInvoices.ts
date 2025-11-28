// lib/teacherInvoices.ts

import React, { type ReactElement } from "react";

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
 * Shared status pill component for teacher invoice status.
 * Used on both teacher and admin invoice pages.
 */
export function TeacherInvoiceStatusPill({
  status,
}: {
  status: InvoiceStatus;
}): ReactElement {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

  let className = base;
  let label = "Not generated";

  if (status === "paid") {
    className += " bg-green-100 text-green-800";
    label = "Paid";
  } else if (status === "generated") {
    className += " bg-amber-100 text-amber-800";
    label = "Generated";
  } else {
    className += " bg-gray-100 text-gray-800";
    label = "Not generated";
  }

  return React.createElement("span", { className }, label);
}
