// app/(admin)/admin/teachers/[teacherId]/invoices/[invoiceId]/page.tsx

import Section from "@/components/ui/Section";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  formatMinutesAsHours,
  formatPenniesAsPounds,
  formatDateTimeLondon,
} from "@/lib/formatters";
import { notFound } from "next/navigation";
import ExpenseStatusButtons from "@/components/admin/ExpenseStatusButtons";


export const dynamic = "force-dynamic";

type TeacherInvoice = {
  id: number;
  teacher_id: string;
  month_start: string; // 'YYYY-MM-DD'
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
  status: "not_generated" | "generated" | "paid";
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
};

type StudentEarnings = {
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


function formatMonthLabel(monthStart: string): string {
  const d = new Date(`${monthStart}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function StatusPill({
  status,
}: {
  status: "not_generated" | "generated" | "paid";
}) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
  if (status === "paid") {
    return <span className={`${base} bg-green-100 text-green-800`}>Paid</span>;
  }
  if (status === "generated") {
    return (
      <span className={`${base} bg-amber-100 text-amber-800`}>Generated</span>
    );
  }
  return (
    <span className={`${base} bg-gray-100 text-gray-800`}>Not generated</span>
  );
}

export default async function TeacherInvoiceAdminDetail({
  params,
}: {
  params: Promise<{ teacherId: string; invoiceId: string }>;
}) {
  const { teacherId, invoiceId } = await params;
  const invoiceIdNumber = Number(invoiceId);
  const supabase = await getAdminSupabase();

  // 1) Load the invoice row to get teacher + month
  const { data: invoice, error: invoiceError } = await supabase
    .from("teacher_invoices")
    .select(
      "id, teacher_id, month_start, status, invoice_ref, created_at, paid_at"
    )
    .eq("id", invoiceIdNumber)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return notFound();
  }

  const typedInvoice = invoice as TeacherInvoice;
  const { month_start } = typedInvoice;

  // Look up teacher's full name via teachers → profiles
const { data: teacherRow } = await supabase
  .from("teachers")
  .select("profile_id")
  .eq("id", teacherId)
  .maybeSingle();

let teacherLabel = `Teacher ID ${teacherId}`;

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
      .eq("month_start", month_start)
      .maybeSingle(),
    supabase
      .from("v_teacher_lesson_earnings_by_month")
      .select(
        "teacher_id, month_start, lesson_minutes_total, gross_pennies, snc_free_minutes, snc_charged_minutes"
      )
      .eq("teacher_id", teacherId)
      .eq("month_start", month_start)
      .maybeSingle(),
    supabase
      .from("v_teacher_expenses_summary")
      .select(
        "teacher_id, month_start, approved_pennies, pending_pennies, rejected_pennies"
      )
      .eq("teacher_id", teacherId)
      .eq("month_start", month_start)
      .maybeSingle(),
    supabase
      .from("v_teacher_expenses_detail_by_month")
      .select(
        "id, teacher_id, month_start, incurred_at, amount_pennies, status, description, category"
      )
      .eq("teacher_id", teacherId)
      .eq("month_start", month_start)
      .order("incurred_at", { ascending: true }),
    supabase
      .from("v_teacher_lesson_earnings_by_student_month")
      .select(
        "teacher_id, month_start, student_id, lesson_minutes_total, gross_pennies"
      )
      .eq("teacher_id", teacherId)
      .eq("month_start", month_start)
      .order("student_id", { ascending: true }),
  ]);


  const monthLabel = formatMonthLabel(month_start);
  const summary = (summaryData ?? null) as InvoiceSummary | null;
  const earnings = (earningsData ?? null) as LessonEarningsMonth | null;
  const expenseSummary = (expensesSummaryData ?? null) as ExpenseSummary | null;
  const expenseDetails = (expensesDetailData ?? []) as ExpenseDetail[];
  const studentEarnings = (studentEarningsData ?? []) as StudentEarnings[];

  // Map student_id -> full_name for the table
const studentIds = Array.from(
  new Set(studentEarnings.map((row) => row.student_id).filter(Boolean)),
);

const studentNameById = new Map<string, string>();

if (studentIds.length > 0) {
  const { data: studentNames, error: studentNamesError } = await supabase
    .from("v_student_names")
    .select("student_id, full_name")
    .in("student_id", studentIds);

  if (!studentNamesError && studentNames) {
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

  const displayStatus: "not_generated" | "generated" | "paid" =
    summary?.status ?? "generated"; // there *is* an invoice row

 return (
  <Section
    title="Invoice detail"
    subtitle={`${teacherLabel} · ${monthLabel}`}
  >
      <div className="space-y-6">
        {/* Invoice meta */}
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="space-y-1 text-sm text-gray-800">
            <div>
              <span className="font-semibold">Invoice ID:</span>{" "}
              {invoiceIdNumber}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Status:</span>
              <StatusPill status={displayStatus} />
            </div>
            <div>
              <span className="font-semibold">Invoice ref:</span>{" "}
              {typedInvoice.invoice_ref ?? (
                <span className="text-gray-500">—</span>
              )}
            </div>
            <div className="text-xs text-gray-500">
              Created: {formatDateTimeLondon(typedInvoice.created_at)}
              {typedInvoice.paid_at && (
                <>
                  {" "}
                  · Paid: {formatDateTimeLondon(typedInvoice.paid_at)}
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

    {/* ⬇️ replace old <p>…</p> block with this */}
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
          Lessons + approved expenses for this invoice period.
        </p>
      </div>
    </div>
  </div>

  <StatusPill status={displayStatus} />
</div>


        {/* Lesson earnings panel WITH per-student breakdown */}
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
            SNC minutes (teacher always paid):{" "}
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
                No confirmed lessons for this teacher in this month.
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
  {studentNameById.get(row.student_id) ?? row.student_id}
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

        {/* Expenses summary + detail */}
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Expenses</h2>

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

          <p className="text-xs text-gray-600">
            Only approved expenses are included in the invoice total. Pending
            items should be reviewed and either approved or rejected.
          </p>

          <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">
                    Date
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
                  <th className="px-3 py-2 text-right font-medium text-gray-700">
                    Admin
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
          <div className="text-xs font-medium">
            {exp.category === "drinks"
              ? "Drinks"
              : exp.category === "teaching_resources"
              ? "Teaching resources"
              : "Other"}
          </div>
          <div className="text-[11px] text-gray-600">
            {exp.description ? (
              exp.description
            ) : (
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

        <td className="whitespace-nowrap px-3 py-2 text-right text-[11px] text-gray-500">
          <ExpenseStatusButtons
            expenseId={exp.id}
            currentStatus={exp.status}
          />
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
