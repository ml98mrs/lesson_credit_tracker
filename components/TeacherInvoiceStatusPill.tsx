// components/TeacherInvoiceStatusPill.tsx

"use client";

import React from "react";
import type { InvoiceStatus } from "@/lib/teacherInvoices";
import { getInvoiceStatusMeta } from "@/lib/teacherInvoices";

export function TeacherInvoiceStatusPill({
  status,
}: {
  status: InvoiceStatus;
}) {
  const { label, className } = getInvoiceStatusMeta(status);
  return <span className={className}>{label}</span>;
}
