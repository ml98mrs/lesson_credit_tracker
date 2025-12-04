// app/(teacher)/teacher/invoices/[invoiceId]/page.tsx

import Section from "@/components/ui/Section";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  formatMinutesAsHours,
  formatDateTimeLondon,
} from "@/lib/formatters";
import { TeacherInvoiceStatusPill } from "@/components/TeacherInvoiceStatusPill";
import { formatTeacherMoney } from "@/lib/domain/teachers";
import { getTeacherPortalInvoiceSnapshot } from "@/lib/server/getTeacherPortalInvoiceSnapshot";

export const dynamic = "force-dynamic";

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
  const invoiceIdNumber = Number(invoiceId);

  if (Number.isNaN(invoiceIdNumber)) {
    return (
      <Section title="Invoice details" subtitle="">
        <p className="text-sm text-red-600">
          Invalid invoice ID.
        </p>
      </Section>
    );
  }

  // 1) Use shared snapshot loader (teacher-portal wrapper)
  let snapshot;
  try {
    snapshot = await getTeacherPortalInvoiceSnapshot(teacherId, invoiceIdNumber);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Invoice not found or not accessible.";
    return (
      <Section title="Invoice details" subtitle="">
        <p className="text-sm text-red-600">{message}</p>
      </Section>
    );
  }

  const {
    invoice,
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
  } = snapshot;

  return (
    <Section title="Invoice details" subtitle={monthLabel}>
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

              {displayStatus === "paid" ? (
                <a
                  href={`/teacher/invoices/${invoice.id}/download`}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                >
                  Download Excel
                </a>
              ) : (
                <span className="text-[11px] text-gray-500">
                  Download available once this invoice is marked paid.
                </span>
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
                  {formatTeacherMoney(lessonGrossPennies)}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-gray-600">Expenses (approved)</span>
                <span className="font-semibold text-gray-900">
                  {formatTeacherMoney(approvedExpensesPennies)}
                </span>
              </div>

              <div className="mt-3 border-t border-gray-200 pt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-gray-900">
                    Grand total
                  </span>
                  <span className="text-lg font-semibold text-gray-900">
                    {formatTeacherMoney(totalPennies)}
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
              {formatTeacherMoney(lessonGrossPennies)} total
            </span>
          </p>
          <p className="text-xs text-gray-700">
            SNC minutes (you are paid for all):{" "}
            {formatMinutesAsHours(sncFreeMinutes)} h free ·{" "}
            {formatMinutesAsHours(sncChargedMinutes)} h charged
            (student-side).
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
                            {formatTeacherMoney(gross)}
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
              <div>{formatTeacherMoney(approvedExpensesPennies)}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500">
                Pending
              </div>
              <div>{formatTeacherMoney(pendingExpensesPennies)}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500">
                Rejected
              </div>
              <div>{formatTeacherMoney(rejectedExpensesPennies)}</div>
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
                        {formatTeacherMoney(exp.amount_pennies)}
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
