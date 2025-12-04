// app/(admin)/admin/teachers/[teacherId]/invoices/page.tsx

import Link from "next/link";
import Section from "@/components/ui/Section";
import { getAdminSupabase } from "@/lib/supabase/admin";
import GenerateInvoiceButton from "@/components/admin/GenerateInvoiceButton";
import {
  getInvoiceMonthKey,
  formatInvoiceMonthLabel,
} from "@/lib/teacherInvoices";
import { TeacherInvoiceStatusPill } from "@/components/TeacherInvoiceStatusPill";
import type { TeacherInvoiceSummary } from "@/lib/types/teachers";
import { formatTeacherMoney } from "@/lib/domain/teachers";
import { listTeacherInvoicesForTeacher } from "@/lib/server/listTeacherInvoices";

export const dynamic = "force-dynamic";

export default async function TeacherInvoicesAdmin({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const { teacherId } = await params;
  const supabase = await getAdminSupabase();

  // --- Resolve teacher name for the header ---
  let teacherLabel = `Teacher ID: ${teacherId}`;

  const { data: teacherRow } = await supabase
    .from("teachers")
    .select("profile_id")
    .eq("id", teacherId)
    .maybeSingle();

  if (teacherRow?.profile_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", teacherRow.profile_id)
      .maybeSingle();

    if (profile?.full_name) {
      teacherLabel = profile.full_name;
    }
  }

  // --- Load per-month summaries + invoice rows via shared helper ---

  let invoiceSummaries: TeacherInvoiceSummary[] = [];
  let invoiceLoadError: Error | null = null;

  try {
    invoiceSummaries = await listTeacherInvoicesForTeacher(supabase, teacherId);
  } catch (err) {
    invoiceLoadError = err as Error;
    console.error("[admin] Error loading teacher invoice summaries", err);
  }

  if (invoiceLoadError) {
    return (
      <Section
        title="Teacher invoices"
        subtitle="Monthly earnings and approved expenses."
      >
        <p className="mb-2 text-sm text-gray-700">{teacherLabel}</p>
        <p className="text-sm text-red-600">
          Sorry — we couldn&apos;t load invoice data for this teacher.
        </p>
      </Section>
    );
  }

  // Limit to the latest 24 months (matching previous behaviour)
  const summaryRows = invoiceSummaries.slice(0, 24);

  // Build a map of monthStart -> TeacherInvoiceSummary (from shared helper)
  const invoiceByMonth = new Map<string, TeacherInvoiceSummary>();
  for (const inv of summaryRows) {
    invoiceByMonth.set(inv.monthStart, inv);
  }

  // "Invoice month" = previous calendar month (last full month)
  const invoiceMonthKey = getInvoiceMonthKey();
  const invoiceMonthLabel = formatInvoiceMonthLabel(invoiceMonthKey);

  const invoiceMonthSummary = summaryRows.find(
    (row) => row.monthStart === invoiceMonthKey,
  );

  // History = all other months (older and, if present, any newer months)
  const historyRows = summaryRows.filter(
    (row) => row.monthStart !== invoiceMonthKey,
  );

  const invoiceLessonGross = invoiceMonthSummary?.lessonGrossPennies ?? 0;
  const invoiceExpenses = invoiceMonthSummary?.expensesPennies ?? 0;
  const invoiceTotal = invoiceMonthSummary?.totalPennies ?? 0;

  return (
    <Section
      title="Teacher invoices"
      subtitle="Monthly snapshot of lessons, approved expenses, and invoice status."
    >
      <div className="mb-4 text-xs">
        <Link
          href={`/admin/teachers/${teacherId}`}
          className="text-blue-700 underline"
        >
          ← Back to Teacher 360
        </Link>
      </div>

      <p className="mb-4 text-xs text-gray-600">Teacher: {teacherLabel}</p>

      <div className="space-y-8">
        {/* Latest invoice-month card (aligned with teacher portal wording) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Latest invoice month
              </h2>
              <p className="mt-1 text-xs text-gray-600">
                Confirmed lesson earnings and approved expenses for{" "}
                <span className="font-medium">{invoiceMonthLabel}</span>. This
                is the month the teacher&apos;s next invoice is based on.
              </p>

              {invoiceMonthSummary ? (
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex items-baseline justify-between">
                    <span className="text-gray-600">
                      Lesson earnings total
                    </span>
                    <span className="font-semibold text-gray-900">
                      {formatTeacherMoney(invoiceLessonGross)}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="text-gray-600">Expenses (approved)</span>
                    <span className="font-semibold text-gray-900">
                      {formatTeacherMoney(invoiceExpenses)}
                    </span>
                  </div>

                  <div className="mt-3 border-t border-gray-200 pt-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold text-gray-900">
                        Grand total
                      </span>
                      <span className="text-lg font-semibold text-gray-900">
                        {formatTeacherMoney(invoiceTotal)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">
                      Lessons + approved expenses for {invoiceMonthLabel}.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500">
                  No confirmed lessons or approved expenses recorded for{" "}
                  {invoiceMonthLabel} yet.
                </p>
              )}
            </div>

            {/* ⬇ status pill + admin actions wrapper */}
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <TeacherInvoiceStatusPill
                status={invoiceMonthSummary?.status ?? "not_generated"}
              />

              {/* Admin actions: open existing invoice or generate new one */}
              {invoiceMonthSummary &&
                (() => {
                  const inv = invoiceByMonth.get(invoiceMonthKey);
                  if (inv) {
                    return (
                      <Link
                        href={`/admin/teachers/${teacherId}/invoices/${inv.id}`}
                        className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700"
                      >
                        Open invoice detail
                      </Link>
                    );
                  }
                  return (
                    <GenerateInvoiceButton
                      teacherId={teacherId}
                      monthStart={invoiceMonthKey}
                    />
                  );
                })()}
            </div>
          </div>
        </div>

        {/* History table (all other months) */}
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-900">
            Invoice history
          </h2>
          <p className="mb-3 text-xs text-gray-600">
            All other months for this teacher. Lesson earnings come from
            confirmed lessons; expenses reflect approved claims only. Once an
            invoice is generated, it appears here with a link to its detail
            page.
          </p>

          {historyRows.length === 0 ? (
            <p className="text-xs text-gray-500">
              No other months to show yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      Month
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">
                      Lesson earnings
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">
                      Expenses
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">
                      Total
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      Status
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">
                      Invoice
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {historyRows.map((row) => {
                    const inv = invoiceByMonth.get(row.monthStart);
                    const lessonGross = row.lessonGrossPennies ?? 0;
                    const expenses = row.expensesPennies ?? 0;
                    const total = row.totalPennies ?? 0;

                    return (
                      <tr key={row.teacherId + row.monthStart}>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                          {formatInvoiceMonthLabel(row.monthStart)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right">
                          {formatTeacherMoney(lessonGross)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right">
                          {formatTeacherMoney(expenses)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right font-semibold">
                          {formatTeacherMoney(total)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2">
                          <TeacherInvoiceStatusPill status={row.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right">
                          {inv ? (
                            <Link
                              href={`/admin/teachers/${teacherId}/invoices/${inv.id}`}
                              className="text-xs font-medium text-blue-600 hover:text-blue-800"
                            >
                              Open
                            </Link>
                          ) : (
                            <span className="text-[11px] text-gray-400">
                              No invoice row
                            </span>
                          )}
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
    </Section>
  );
}
