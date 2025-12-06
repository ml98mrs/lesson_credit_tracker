// app/(admin)/admin/teachers/invoices/monthly/page.tsx
// Admin monthly teacher invoices overview (defaults to previous calendar month if no ?monthStart= is provided)

import Link from "next/link";
import Section from "@/components/ui/Section";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  getInvoiceMonthKey,
  formatInvoiceMonthLabel,
} from "@/lib/teacherInvoices";
import BulkMarkInvoicesPaidButton from "@/components/admin/BulkMarkInvoicesPaidButton";
import { TeacherInvoiceStatusPill } from "@/components/TeacherInvoiceStatusPill";
import {
  type ProfilesDisplayEmbed,
  readProfileDisplayName,
} from "@/lib/types/profiles";
import { formatTeacherMoney } from "@/lib/domain/teachers";
import type {
  TeacherInvoiceRow,
  TeacherInvoiceMonthSummaryRow,
} from "@/lib/types/teachers";

export const dynamic = "force-dynamic";

// Raw DB shape from v_teacher_invoice_summary
type SummaryRowDb = {
  teacher_id: string;
  month_start: string;
  lesson_gross_pennies: number | null;
  expenses_pennies: number | null;
  total_pennies: number | null;
  status: string; // will be narrowed via InvoiceStatus in the mapped type
};

type InvoiceRow = TeacherInvoiceRow;

export default async function AdminMonthlyTeacherInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ monthStart?: string }>;
}) {
  const { monthStart } = await searchParams;

  // If no monthStart provided, default to previous calendar month
  const monthKey = monthStart ?? getInvoiceMonthKey();
  const monthLabel = formatInvoiceMonthLabel(monthKey);

  const supabase = await getAdminSupabase();

  // 1) All teacher summaries for this invoice month
  const { data: summaryData, error: summaryError } = await supabase
    .from("v_teacher_invoice_summary")
    .select(
      "teacher_id, month_start, lesson_gross_pennies, expenses_pennies, total_pennies, status",
    )
    .eq("month_start", monthKey)
    .order("teacher_id", { ascending: true });

  const summaryRowsDb = (summaryData ?? []) as SummaryRowDb[];

  // Map DB rows -> domain/camelCase rows
  const summaryRows: TeacherInvoiceMonthSummaryRow[] = summaryRowsDb.map(
    (r) => ({
      teacherId: r.teacher_id,
      monthStart: r.month_start,
      lessonGrossPennies: r.lesson_gross_pennies ?? 0,
      expensesPennies: r.expenses_pennies ?? 0,
      totalPennies: r.total_pennies ?? 0,
      status: r.status as TeacherInvoiceMonthSummaryRow["status"],
    }),
  );

  // Collect teacher ids
  const teacherIds = Array.from(new Set(summaryRows.map((r) => r.teacherId)));

  // 2) Invoice rows for this month (one per teacher_id ideally)
  const { data: invoicesData } = await supabase
    .from("teacher_invoices")
    .select(
      "id, teacher_id, month_start, status, invoice_ref, created_at, paid_at",
    )
    .eq("month_start", monthKey);

  const invoiceRows = (invoicesData ?? []) as InvoiceRow[];
  const invoiceByTeacher = new Map<string, InvoiceRow>();
  for (const inv of invoiceRows) {
    invoiceByTeacher.set(inv.teacher_id, inv);
  }

  // 3) Resolve teacher names (teachers → profiles)
  const teacherNameById = new Map<string, string>();

  if (teacherIds.length > 0) {
    const { data: teacherRows, error: tErr } = await supabase
      .from("teachers")
      .select("id, profiles(full_name, preferred_name)")
      .in("id", teacherIds);

    if (tErr) {
      // Soft-fail: keep going but fall back to teacher_id in the UI
      console.error("Error loading teacher names for invoices:", tErr.message);
    }

    type TeacherWithProfileRow = {
      id: string;
      profiles: ProfilesDisplayEmbed | null;
    };

    const teachers = (teacherRows ?? []) as TeacherWithProfileRow[];

    for (const t of teachers) {
      const displayName =
        readProfileDisplayName(t.profiles ?? undefined) ??
        `Teacher ID: ${t.id}`;

      teacherNameById.set(t.id, displayName);
    }
  }

  const generatedCount = summaryRows.filter(
    (r) => r.status === "generated",
  ).length;

  return (
    <Section
      title="Teacher invoices – monthly overview"
      subtitle={`All teacher invoice summaries for ${monthLabel}. Use this view when running monthly payroll.`}
    >
      {summaryError && (
        <p className="mb-3 text-xs text-red-600">
          Couldn&apos;t load invoice summaries for this month.
        </p>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-600">
          Showing {summaryRows.length} teachers with activity in{" "}
          <span className="font-medium">{monthLabel}</span>.
        </p>
        <BulkMarkInvoicesPaidButton
          monthStart={monthKey}
          generatedCount={generatedCount}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-700">
                Teacher
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
            {summaryRows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-4 text-center text-[11px] text-gray-500"
                >
                  No teacher invoice activity recorded for {monthLabel}.
                </td>
              </tr>
            ) : (
              summaryRows.map((row) => {
                const teacherName =
                  teacherNameById.get(row.teacherId) ?? row.teacherId;
                const inv = invoiceByTeacher.get(row.teacherId);

                const lessonGross = row.lessonGrossPennies;
                const expenses = row.expensesPennies;
                const total = row.totalPennies;

                return (
                  <tr key={row.teacherId}>
                    <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                      {teacherName}
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
                          href={`/admin/teachers/${row.teacherId}/invoices/${inv.id}`}
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
              })
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
