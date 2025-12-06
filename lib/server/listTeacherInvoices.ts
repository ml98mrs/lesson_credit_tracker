// lib/server/listTeacherInvoices.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { TeacherInvoiceSummary } from "@/lib/types/teachers";
import type { InvoiceStatus } from "@/lib/teacherInvoices";

export async function listTeacherInvoicesForTeacher(
  supabase: SupabaseClient<Database>,
  teacherId: string,
): Promise<TeacherInvoiceSummary[]> {
  const { data, error } = await supabase
    .from("teacher_invoices")
    .select("id, teacher_id, month_start, status, invoice_ref")
    .eq("teacher_id", teacherId)
    .order("month_start", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    teacherId: row.teacher_id,
    monthStart: row.month_start,
    status: row.status as InvoiceStatus,
    invoiceRef: row.invoice_ref,
  }));
}
