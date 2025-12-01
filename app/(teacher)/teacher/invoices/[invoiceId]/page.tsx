// app/(teacher)/teacher/invoices/[invoiceId]/page.tsx

import Link from "next/link";
import Section from "@/components/ui/Section";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  formatMinutesAsHours,
  formatPenniesAsPounds,
  formatDateTimeLondon,
} from "@/lib/formatters";
import {
  formatInvoiceMonthLabel,
  type InvoiceStatus,
} from "@/lib/teacherInvoices";
import { TeacherInvoiceStatusPill } from "@/components/TeacherInvoiceStatusPill";

export const dynamic = "force-dynamic";

type TeacherInvoice = {
  id: number;
  teacher_id: string;
  month_start: string; // "YYYY-MM-01"
  status: "generated" | "paid";
  invoice_ref: string | null;
  created_at: string;
  paid_at: string | null;
};

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

export default async function TeacherInvoiceDetailPage(props: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await props.params;
  const supabase = await getServerSupabase();

  // 0) Map logged-in user → teacher_id
  const { data: u } = await supabase.auth.getUser();
  const user = u?.user;

  if (!user) {
    return (
      <Section title="Invoice details" subtitle="">
        <p className="text-sm text-gray-600">Please sign in.</p>
      </Section>
    );
  }

  const { data: t, error: teacherError } = await supabase
    .from("teachers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (teacherError || !t?.id) {
    return (
      <Section title="Invoice details" subtitle="">
        <p className="text-sm text-red-600">
          Teacher record not found for this user.
        </p>
      </Section>
    );
  }

  const teacherId = t.id as string;

  // 1) Load invoice row (and verify it belongs to this teacher)
  const invoiceIdNumber = Number(invoiceId);

  const { data: invoiceRow, error: invErr } = await supabase
    .from("teacher_invoices")
    .select(
      "id, teacher_id, month_start, status, invoice_ref, created_at, paid_at"
    )
    .eq("id", invoiceIdNumber)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (invErr || !invoiceRow) {
    return (
      <Section title="Invoice details" subtitle="">
        <p className="text-sm text-red-600">
          Invoice not found or not accessible.
        </p>
      </Section>
    );
  }

  const invoice = invoiceRow as TeacherInvoice;
  const monthStart = invoice.month_start;
  const monthLabel = formatInvoiceMonthLabel(monthStart);

  // 2) Load monthly aggregates + itemised expenses + per-student earnings
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
        "teacher_id, month_start, lesson_gross_pennies, expenses_pennies, total_pennies, status"
      )
      .eq("teacher_id", teacherId)
      .eq("month_start", monthStart)
      .maybeSingle(),
    supabase
      .from("v_teacher_lesson_earnings_by_month")
      .select(
        "teacher_id, month_start, lesson_minutes_total, gross_pennies, snc_free_minutes, snc_charged_minutes"
      )
      .eq("teacher_id", teacherId)
      .eq("month_start", monthStart)
      .maybeSingle(),
    supabase
      .from("v_teacher_expenses_summary")
      .select(
        "teacher_id, month_start, approved_pennies, pending_pennies, rejected_pennies"
      )
      .eq("teacher_id", teacherId)
      .eq("month_start", monthStart)
      .maybeSingle(),
    supabase
      .from("v_teacher_expenses_detail_by_month")
      .select(
        "id, teacher_id, month_start, incurred_at, amount_pennies, status, description, category, student_id, student_name, student_full_name"
      )
      .eq("teacher_id", teacherId)
      .eq("month_start", monthStart)
      .order("incurred_at", { ascending: true }),
    supabase
      .from("v_teacher_lesson_earnings_by_student_month")
      .select(
        "teacher_id, month_start, student_id, lesson_minutes_total, gross_pennies"
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

  // 3) Map student_id → full_name for the table
  const studentIds = Array.from(
    new Set(studentEarnings.map((row) => row.student_id).filter(Boolean))
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

  return (
    <Section
      title="Invoice details"
      subtitle={`${monthLabel}`}
    >
      <div className="space-y-6">
        {/* Invoice meta */}
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="space-y-1 text-sm text-gray-800">
            <div>
              <span className="font-semibold">Invoice ID:</span>{" "}
              {invoice.id}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Status:</span>
              <TeacherInvoiceStatusPill status={displayStatus} />
            </div>
            <div className="text-xs text-gray-500">
              Created: {formatDateTimeLondon(invoice.created_at)}
              {invoice.paid_at && (
                <>
                  {" "}
                  · Paid: {formatDateTimeLondon(invoice.paid_at)}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Top-level totals */}
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {monthLabel} invoice period
            </h2>

            <div className="mt-3 space-y-1 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-gray-600">Hours total</span>
                <span className="font-semibold text-gray-900">
                  {formatMinutesAsHours(lessonMinutesTotal)} h
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-gray-600">Lesson earnings total</span>
                <span className="font-semibold text-gray-900">
                  {formatPenniesAsPounds(lessonGrossPennies)}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-gray-600">Expenses (approved)</span>
                <span className="font-semibold text-gray-900">
                  {formatPenniesAsPounds(approvedExpensesPennies)}
                </span>
              </div>

              <div className="mt-3 border-t border-gray-200 pt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-gray-900">
                    Grand total
                  </span>
                  <span className="text-lg font-semibold text-gray-900">
                    {formatPenniesAsPounds(totalPennies)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-gray-500">
                  Lessons + approved expenses for this invoice period.
                </p>
              </div>
            </div>
          </div>

          <TeacherInvoiceStatusPill status={displayStatus} />
        </div>

        {/* Lesson earnings panel */}
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">
            Lesson earnings
          </h2>
          <p className="text-sm text-gray-900">
            Confirmed lessons in this invoice month:{" "}
            <span className="font-semibold">
              {formatMinutesAsHours(lessonMinutesTotal)} h ·{" "}
              {formatPenniesAsPounds(lessonGrossPennies)} total
            </span>
          </p>
          <p className="text-xs text-gray-700">
            SNC minutes (you are paid for all):{" "}
            {formatMinutesAsHours(sncFreeMinutes)} h free ·{" "}
            {formatMinutesAsHours(sncChargedMinutes)} h charged (student-side).
          </p>

          <div className="mt-3 border-t border-gray-100 pt-3">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Per-student breakdown (invoice month)
            </h3>

            {studentEarnings.length === 0 ? (
              <p className="text-[11px] text-gray-500">
                No confirmed lessons for this month.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">
                        Student
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">
                        Hours
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {studentEarnings.map((row) => {
                      const minutes = row.lesson_minutes_total ?? 0;
                      const gross = row.gross_pennies ?? 0;
                      return (
                        <tr key={row.teacher_id + row.student_id}>
                          <td className="px-3 py-2 text-gray-900">
                            {studentNameById.get(row.student_id) ??
                              row.student_id}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-gray-900">
                            {formatMinutesAsHours(minutes)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-gray-900">
                            {formatPenniesAsPounds(gross)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Expenses panel */}
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Expenses</h2>

          <div className="grid grid-cols-3 gap-4 text-sm text-gray-900">
            <div>
              <div className="text-xs font-semibold text-gray-500">
                Approved
              </div>
              <div>{formatPenniesAsPounds(approvedExpensesPennies)}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500">
                Pending
              </div>
              <div>{formatPenniesAsPounds(pendingExpensesPennies)}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500">
                Rejected
              </div>
              <div>{formatPenniesAsPounds(rejectedExpensesPennies)}</div>
            </div>
          </div>

          <p className="text-xs text-gray-600">
            Only approved expenses are included in the invoice total above.
          </p>

          <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">
                    Date
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">
                    Student
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">
                    Description
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">
                    Amount
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {expenseDetails.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-3 text-center text-[11px] text-gray-500"
                    >
                      No expenses logged for this invoice month.
                    </td>
                  </tr>
                ) : (
                  expenseDetails.map((exp) => (
                    <tr key={exp.id}>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-900">
                        {formatDateTimeLondon(exp.incurred_at)}
                      </td>
                      <td className="px-3 py-2 text-gray-900">
                        {exp.student_name ||
                          exp.student_full_name ||
                          (exp.student_id ?? "—")}
                      </td>
                      <td className="px-3 py-2 text-gray-900">
                        <div className="text-xs font-medium">
                          {exp.category === "drinks"
                            ? "Drinks"
                            : exp.category === "teaching_resources"
                            ? "Teaching resources"
                            : "Other"}
                        </div>
                        <div className="text-[11px] text-gray-600">
                          {exp.description ?? (
                            <span className="text-gray-400">No details</span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-gray-900">
                        {formatPenniesAsPounds(exp.amount_pennies)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-900">
                        {exp.status}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Section>
  );
}
