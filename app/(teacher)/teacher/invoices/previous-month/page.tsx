// app/(teacher)/teacher/invoices/previous-month/page.tsx
// Invoice month snapshot (defaults to previous calendar month if no ?monthStart= is provided)

import Section from "@/components/ui/Section";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  formatMinutesAsHours,
  formatPenniesAsPounds,
} from "@/lib/formatters";
import {
  getInvoiceMonthKey,
  formatInvoiceMonthLabel,
  type InvoiceStatus,
} from "@/lib/teacherInvoices";
import { TeacherInvoiceStatusPill } from "@/components/TeacherInvoiceStatusPill";

export const dynamic = "force-dynamic";

type InvoiceSummary = {
  month_start: string;
  lesson_gross_pennies: number | null;
  expenses_pennies: number | null;
  total_pennies: number | null;
  status: InvoiceStatus;
};

type LessonEarningsMonth = {
  month_start: string;
  lesson_minutes_total: number | null;
  gross_pennies: number | null;
  snc_free_minutes: number | null;
  snc_charged_minutes: number | null;
};

type ExpenseSummary = {
  month_start: string;
  approved_pennies: number | null;
  pending_pennies: number | null;
  rejected_pennies: number | null;
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

export default async function TeacherInvoiceMonthSnapshotPage({
  searchParams,
}: {
  searchParams: Promise<{ monthStart?: string }>;
}) {
  const { monthStart } = await searchParams;

  // If no monthStart provided, default to previous calendar month
  const monthKey = monthStart ?? getInvoiceMonthKey();
  const monthLabel = formatInvoiceMonthLabel(monthKey);

  const supabase = await getServerSupabase();

  // Map logged-in user → teacher_id (same pattern as other teacher pages)
  const { data: u } = await supabase.auth.getUser();
  const user = u?.user;

  if (!user) {
    return (
      <Section
        title="Invoice month snapshot"
        subtitle={monthLabel}
      >
        <p className="text-sm text-gray-600">Please sign in as a teacher.</p>
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
      <Section
        title="Invoice month snapshot"
        subtitle={monthLabel}
      >
        <p className="text-sm text-red-600">
          Error: teacher record not found for this login.
        </p>
      </Section>
    );
  }

  const teacherId = t.id as string;

  const [
    { data: summaryData, error: summaryError },
    { data: earningsData, error: earningsError },
    { data: expensesSummaryData, error: expensesError },
    { data: studentEarningsData, error: studentEarningsError },
  ] = await Promise.all([
    supabase
      .from("v_teacher_invoice_summary")
      .select(
        "month_start, lesson_gross_pennies, expenses_pennies, total_pennies, status",
      )
      .eq("teacher_id", teacherId)
      .eq("month_start", monthKey)
      .maybeSingle(),
    supabase
      .from("v_teacher_lesson_earnings_by_month")
      .select(
        "month_start, lesson_minutes_total, gross_pennies, snc_free_minutes, snc_charged_minutes",
      )
      .eq("teacher_id", teacherId)
      .eq("month_start", monthKey)
      .maybeSingle(),
    supabase
      .from("v_teacher_expenses_summary")
      .select(
        "month_start, approved_pennies, pending_pennies, rejected_pennies",
      )
      .eq("teacher_id", teacherId)
      .eq("month_start", monthKey)
      .maybeSingle(),
    supabase
      .from("v_teacher_lesson_earnings_by_student_month")
      .select(
        "teacher_id, month_start, student_id, lesson_minutes_total, gross_pennies",
      )
      .eq("teacher_id", teacherId)
      .eq("month_start", monthKey)
      .order("student_id", { ascending: true }),
  ]);

  // Hard failure: some core query died
  if (summaryError || earningsError || expensesError) {
    return (
      <Section
        title="Invoice month snapshot"
        subtitle={monthLabel}
      >
        <p className="text-sm text-red-600">
          Sorry — there was a problem loading your invoice month snapshot.
        </p>
      </Section>
    );
  }

  const summary = (summaryData ?? null) as InvoiceSummary | null;
  const earnings = (earningsData ?? null) as LessonEarningsMonth | null;
  const expenseSummary = (expensesSummaryData ?? null) as ExpenseSummary | null;
  const studentEarnings = (studentEarningsData ?? []) as StudentEarningsRow[];

  // Map student_id -> full_name for the table
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

  const lessonMinutesTotal = earnings?.lesson_minutes_total ?? 0;
  const lessonGrossPennies = earnings?.gross_pennies ?? 0;
  const sncFreeMinutes = earnings?.snc_free_minutes ?? 0;
  const sncChargedMinutes = earnings?.snc_charged_minutes ?? 0;

  const approvedExpensesPennies = expenseSummary?.approved_pennies ?? 0;
  const pendingExpensesPennies = expenseSummary?.pending_pennies ?? 0;
  const rejectedExpensesPennies = expenseSummary?.rejected_pennies ?? 0;

  const totalPennies =
    summary?.total_pennies ?? lessonGrossPennies + approvedExpensesPennies;

  const status: InvoiceStatus = summary?.status ?? "not_generated";

  return (
    <Section
      title="Invoice month snapshot"
      subtitle={monthLabel}
    >
      <div className="space-y-6">
        {/* Top summary = invoice month totals */}
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

              {pendingExpensesPennies > 0 && (
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-gray-500">
                    Pending expenses (not yet included)
                  </span>
                  <span className="font-medium text-gray-800">
                    {formatPenniesAsPounds(pendingExpensesPennies)}
                  </span>
                </div>
              )}

              {/* Grand total */}
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
                  Lessons + approved expenses for {monthLabel}. Pending
                  expenses will be included once approved by admin.
                </p>
              </div>
            </div>
          </div>

          <TeacherInvoiceStatusPill status={status} />
        </div>

        {/* Lesson earnings panel with per-student breakdown */}
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

            {studentEarningsError && (
              <p className="text-xs text-red-600">
                Couldn&apos;t load per-student breakdown.
              </p>
            )}

            {!studentEarningsError && studentEarnings.length === 0 && (
              <p className="text-xs text-gray-500">
                No confirmed lessons recorded in this invoice month.
              </p>
            )}

            {!studentEarningsError && studentEarnings.length > 0 && (
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

        {/* Expenses summary */}
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Expenses</h2>

          {expensesError ? (
            <p className="text-xs text-red-600">
              Couldn&apos;t load expenses for this invoice month.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 text-sm text-gray-900">
                <div>
                  <div className="text-xs font-semibold text-gray-500">
                    Approved
                  </div>
                  <div>
                    {formatPenniesAsPounds(approvedExpensesPennies)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500">
                    Pending
                  </div>
                  <div>
                    {formatPenniesAsPounds(pendingExpensesPennies)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500">
                    Rejected
                  </div>
                  <div>
                    {formatPenniesAsPounds(rejectedExpensesPennies)}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-600">
                Only approved expenses for {monthLabel} are included in the
                invoice month total above. Pending items will be rolled into the
                invoice once approved by admin.
              </p>
            </>
          )}
        </div>
      </div>
    </Section>
  );
}
