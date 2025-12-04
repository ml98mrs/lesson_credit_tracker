// lib/server/loadTeacherInvoiceSnapshot.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatInvoiceMonthLabel,
  type InvoiceStatus,
} from "@/lib/teacherInvoices";
import type { TeacherInvoiceRow } from "@/lib/types/teachers";

type InvoiceSummary = {
  teacher_id: string;
  month_start: string;
  lesson_gross_pennies: number | null;
  expenses_pennies: number | null;
  total_pennies: number | null;
  status: InvoiceStatus;
};

type LessonEarningsMonth = {
  teacher_id: string;
  month_start: string;
  lesson_minutes_total: number | null;
  gross_pennies: number | null;
  snc_free_minutes: number | null;
  snc_charged_minutes: number | null;
};

type ExpenseSummary = {
  teacher_id: string;
  month_start: string;
  approved_pennies: number | null;
  pending_pennies: number | null;
  rejected_pennies: number | null;
};

type ExpenseDetail = {
  id: number;
  teacher_id: string;
  month_start: string;
  incurred_at: string;
  amount_pennies: number;
  status: "pending" | "approved" | "rejected";
  description: string | null;
  category: "drinks" | "teaching_resources" | "other";
  student_id: string | null;
  student_name: string | null;
  student_full_name: string | null;
};

type StudentEarningsRow = {
  teacher_id: string;
  month_start: string;
  student_id: string;
  lesson_minutes_total: number | null;
  gross_pennies: number | null;
};

type StudentNameRow = {
  student_id: string;
  full_name: string;
};

export type TeacherInvoiceSnapshot = {
  invoice: TeacherInvoiceRow;
  teacherId: string;
  monthStart: string;
  monthLabel: string;

  // Core money/time totals
  lessonMinutesTotal: number;
  lessonGrossPennies: number;
  sncFreeMinutes: number;
  sncChargedMinutes: number;

  approvedExpensesPennies: number;
  pendingExpensesPennies: number;
  rejectedExpensesPennies: number;
  totalPennies: number;

  displayStatus: InvoiceStatus;

  // Raw-ish lists for UI / Excel
  expenseDetails: ExpenseDetail[];
  studentEarnings: StudentEarningsRow[];
  studentNameById: Map<string, string>;
};

type LoadOpts = {
  supabase: SupabaseClient;
  teacherId: string;
  invoiceId: number;
  requirePaid?: boolean;
};

export async function loadTeacherInvoiceSnapshot({
  supabase,
  teacherId,
  invoiceId,
  requirePaid,
}: LoadOpts): Promise<TeacherInvoiceSnapshot> {
  // 1) Invoice row (and teacher ownership)
  const { data: invoiceRow, error: invoiceError } = await supabase
    .from("teacher_invoices")
    .select(
      "id, teacher_id, month_start, status, invoice_ref, created_at, paid_at",
    )
    .eq("id", invoiceId)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (invoiceError || !invoiceRow) {
    throw new Error("Invoice not found or not accessible");
  }

  const invoice = invoiceRow as TeacherInvoiceRow;

  if (requirePaid && invoice.status !== "paid") {
    throw new Error("Invoice not paid yet");
  }

  const monthStart = invoice.month_start;
  const monthLabel = formatInvoiceMonthLabel(monthStart);

  // 2) All the view lookups in one go
  const [
    { data: summaryData },
    { data: earningsData },
    { data: expensesSummaryData },
    { data: expensesDetailData },
    { data: studentEarningsData },
  ] = await Promise.all([
    supabase
      .from("v_teacher_invoice_summary")
      .select(
        "teacher_id, month_start, lesson_gross_pennies, expenses_pennies, total_pennies, status",
      )
      .eq("teacher_id", teacherId)
      .eq("month_start", monthStart)
      .maybeSingle(),
    supabase
      .from("v_teacher_lesson_earnings_by_month")
      .select(
        "teacher_id, month_start, lesson_minutes_total, gross_pennies, snc_free_minutes, snc_charged_minutes",
      )
      .eq("teacher_id", teacherId)
      .eq("month_start", monthStart)
      .maybeSingle(),
    supabase
      .from("v_teacher_expenses_summary")
      .select(
        "teacher_id, month_start, approved_pennies, pending_pennies, rejected_pennies",
      )
      .eq("teacher_id", teacherId)
      .eq("month_start", monthStart)
      .maybeSingle(),
    supabase
      .from("v_teacher_expenses_detail_by_month")
      .select(
        "id, teacher_id, month_start, incurred_at, amount_pennies, status, description, category, student_id, student_name, student_full_name",
      )
      .eq("teacher_id", teacherId)
      .eq("month_start", monthStart)
      .order("incurred_at", { ascending: true }),
    supabase
      .from("v_teacher_lesson_earnings_by_student_month")
      .select(
        "teacher_id, month_start, student_id, lesson_minutes_total, gross_pennies",
      )
      .eq("teacher_id", teacherId)
      .eq("month_start", monthStart)
      .order("student_id", { ascending: true }),
  ]);

  const summary = (summaryData ?? null) as InvoiceSummary | null;
  const earnings = (earningsData ?? null) as LessonEarningsMonth | null;
  const expenseSummary = (expensesSummaryData ?? null) as ExpenseSummary | null;
  const expenseDetails = (expensesDetailData ?? []) as ExpenseDetail[];
  const studentEarnings = (studentEarningsData ?? []) as StudentEarningsRow[];

  // 3) Student names
  const studentIds = Array.from(
    new Set(studentEarnings.map((row) => row.student_id).filter(Boolean)),
  );

  const studentNameById = new Map<string, string>();

  if (studentIds.length > 0) {
    const { data: studentNames } = await supabase
      .from("v_student_names")
      .select("student_id, full_name")
      .in("student_id", studentIds);

    if (studentNames) {
      for (const sn of studentNames as StudentNameRow[]) {
        studentNameById.set(sn.student_id, sn.full_name);
      }
    }
  }

  // 4) Totals
  const lessonMinutesTotal = earnings?.lesson_minutes_total ?? 0;
  const lessonGrossPennies = earnings?.gross_pennies ?? 0;
  const sncFreeMinutes = earnings?.snc_free_minutes ?? 0;
  const sncChargedMinutes = earnings?.snc_charged_minutes ?? 0;

  const approvedExpensesPennies = expenseSummary?.approved_pennies ?? 0;
  const pendingExpensesPennies = expenseSummary?.pending_pennies ?? 0;
  const rejectedExpensesPennies = expenseSummary?.rejected_pennies ?? 0;

  const totalPennies =
    summary?.total_pennies ?? lessonGrossPennies + approvedExpensesPennies;

  const displayStatus: InvoiceStatus = summary?.status ?? "generated";

  return {
    invoice,
    teacherId,
    monthStart,
    monthLabel,
    lessonMinutesTotal,
    lessonGrossPennies,
    sncFreeMinutes,
    sncChargedMinutes,
    approvedExpensesPennies,
    pendingExpensesPennies,
    rejectedExpensesPennies,
    totalPennies,
    displayStatus,
    expenseDetails,
    studentEarnings,
    studentNameById,
  };
}