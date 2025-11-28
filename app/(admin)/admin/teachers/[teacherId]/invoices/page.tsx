// app/(admin)/admin/teachers/[teacherId]/invoices/page.tsx

import Link from "next/link";
import Section from "@/components/ui/Section";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { formatPenniesAsPounds } from "@/lib/formatters";
import GenerateInvoiceButton from "@/components/admin/GenerateInvoiceButton";
import {
  getInvoiceMonthKey,
  formatInvoiceMonthLabel,
  type InvoiceStatus,
} from "@/lib/teacherInvoices";
import { TeacherInvoiceStatusPill } from "@/components/TeacherInvoiceStatusPill";

export const dynamic = "force-dynamic";

type InvoiceSummaryRow = {
  teacher_id: string;
  month_start: string; // 'YYYY-MM-DD'
  lesson_gross_pennies: number | null;
  expenses_pennies: number | null;
  total_pennies: number | null;
  status: InvoiceStatus;
};

type TeacherInvoiceRow = {
  id: number;
  teacher_id: string;
  month_start: string; // 'YYYY-MM-DD'
  status: "generated" | "paid";
  invoice_ref: string | null;
  created_at: string;
  paid_at: string | null;
};

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

  const [
    { data: summaries, error: summaryError },
    { data: invoices, error: invoiceError },
  ] = await Promise.all([
    supabase
      .from("v_teacher_invoice_summary")
      .select(
        "teacher_id, month_start, lesson_gross_pennies, expenses_pennies, total_pennies, status",
      )
      .eq("teacher_id", teacherId)
      .order("month_start", { ascending: false })
      .limit(24),
    supabase
      .from("teacher_invoices")
      .select(
        "id, teacher_id, month_start, status, invoice_ref, created_at, paid_at",
      )
      .eq("teacher_id", teacherId)
      .order("month_start", { ascending: false })
      .limit(24),
  ]);

  if (summaryError || invoiceError) {
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

  const summaryRows: InvoiceSummaryRow[] = summaries ?? [];
  const invoiceRows: TeacherInvoiceRow[] = invoices ?? [];

  const invoiceByMonth = new Map<string, TeacherInvoiceRow>();
  for (const inv of invoiceRows) {
    invoiceByMonth.set(inv.month_start, inv);
  }

  // "Invoice month" = previous calendar month (last full month)
  const invoiceMonthKey = getInvoiceMonthKey();
  const invoiceMonthLabel = formatInvoiceMonthLabel(invoiceMonthKey);

  const invoiceMonthSummary = summaryRows.find(
    (row) => row.month_start === invoiceMonthKey,
  );

  // History = all other months (older and, if present, any newer months)
  // This matches the teacher invoice index semantics.
  const historyRows = summaryRows.filter(
    (row) => row.month_start !== invoiceMonthKey,
  );

  const invoiceLessonGross = invoiceMonthSummary?.lesson_gross_pennies ?? 0;
  const invoiceExpenses = invoiceMonthSummary?.expenses_pennies ?? 0;
  const invoiceTotal = invoiceMonthSummary?.total_pennies ?? 0;

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
                    <span className="text-gray-600">Lesson earnings total</span>
                    <span className="font-semibold text-gray-900">
                      {formatPenniesAsPounds(invoiceLessonGross)}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="text-gray-600">Expenses (approved)</span>
                    <span className="font-semibold text-gray-900">
                      {formatPenniesAsPounds(invoiceExpenses)}
                    </span>
                  </div>

                  <div className="mt-3 border-t border-gray-200 pt-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold text-gray-900">
                        Grand total
                      </span>
                      <span className="text-lg font-semibold text-gray-900">
                        {formatPenniesAsPounds(invoiceTotal)}
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
              {invoiceMonthSummary && (() => {
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
                    const inv = invoiceByMonth.get(row.month_start);
                    const lessonGross = row.lesson_gross_pennies ?? 0;
                    const expenses = row.expenses_pennies ?? 0;
                    const total = row.total_pennies ?? 0;

                    return (
                      <tr key={row.teacher_id + row.month_start}>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                          {formatInvoiceMonthLabel(row.month_start)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right">
                          {formatPenniesAsPounds(lessonGross)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right">
                          {formatPenniesAsPounds(expenses)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right font-semibold">
                          {formatPenniesAsPounds(total)}
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
