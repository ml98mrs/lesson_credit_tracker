// lib/types/teachers.ts
import type { Database } from "@/lib/database.types";
import type { InvoiceStatus } from "@/lib/teacherInvoices"; // ✅ NEW

// ---------------------------------------------------------------------------
// Core teacher types
// ---------------------------------------------------------------------------

// Raw DB row for a teacher (canonical shape from Supabase)
export type TeacherRow = Database["public"]["Tables"]["teachers"]["Row"];

// Status type derived from the DB enum (no local string unions)
export type TeacherStatus = TeacherRow["status"];

// Optional camelCase domain type for use in React / domain logic
export type Teacher = {
  id: TeacherRow["id"];
  profileId: TeacherRow["profile_id"];
  status: TeacherStatus;
  timeZone: TeacherRow["time_zone"] | null;
};

// ---------------------------------------------------------------------------
// Teacher invoices
// ---------------------------------------------------------------------------

// Raw DB row for teacher_invoices (canonical shape from Supabase)
export type TeacherInvoiceRow =
  Database["public"]["Tables"]["teacher_invoices"]["Row"];

// Canonical status type for teacher invoices: reuse InvoiceStatus from
// lib/teacherInvoices instead of a broad `string` from the DB row.
export type TeacherInvoiceStatus = InvoiceStatus;

// Narrow, UI-friendly invoice summary shape you can reuse in pages/components.
// This is intentionally camelCase and “view-shaped”, not DB-shaped.
export type TeacherInvoiceSummary = {
  id: TeacherInvoiceRow["id"];
  teacherId: TeacherInvoiceRow["teacher_id"];
  monthStart: TeacherInvoiceRow["month_start"]; // 'YYYY-MM-01'
  status: TeacherInvoiceStatus; // e.g. 'generated' | 'paid'
  invoiceRef: TeacherInvoiceRow["invoice_ref"] | null;

  // Totals from views (e.g. v_teacher_invoice_summary)
  totalPennies?: number | null;
  lessonGrossPennies?: number | null;
  expensesPennies?: number | null;
};
