// components/TeacherInvoiceStatusPill.tsx

"use client";

import type { TeacherInvoiceStatus } from "@/lib/types/teachers";
import { getTeacherInvoiceStatusMeta } from "@/lib/domain/teachers";

export type TeacherInvoiceStatusPillProps = {
  status: TeacherInvoiceStatus;
};

export function TeacherInvoiceStatusPill({
  status,
}: TeacherInvoiceStatusPillProps) {
  const { label, className } = getTeacherInvoiceStatusMeta(status);

  return <span className={className}>{label}</span>;
}
