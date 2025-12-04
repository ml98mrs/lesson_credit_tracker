// lib/server/listTeacherInvoices.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TeacherInvoiceSummary } from "@/lib/types/teachers";

/**
 * List all teacher_invoices rows for a given teacher, newest month first.
 *
 * This is intentionally DB-row-shaped data (from teacher_invoices), mapped into
 * the narrow TeacherInvoiceSummary used by admin/teacher UIs.
 *
 * Per-month totals still come from v_teacher_invoice_summary in the pages
 * that call this helper.
 */
export async function listTeacherInvoicesForTeacher(
  supabase: SupabaseClient,
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
    status: row.status,
    invoiceRef: row.invoice_ref,
    // Totals still come from v_teacher_invoice_summary in the caller.
    totalPennies: null,
  }));
}
