// app/(teacher)/teacher/dashboard/page.tsx

import Link from "next/link";
import Section from "@/components/ui/Section";
import { getServerSupabase } from "@/lib/supabase/server";
import { formatPenniesAsPounds } from "@/lib/formatters";

type InvoiceStatus = "not_generated" | "generated" | "paid";

type InvoiceSummaryRow = {
  month_start: string;
  lesson_gross_pennies: number | null;
  expenses_pennies: number | null;
  total_pennies: number | null;
  status: InvoiceStatus;
};

type StudentStatusRow = {
  id: string;
  status: "current" | "dormant" | "past";
};

// Invoice month = previous London calendar month
function getInvoiceMonthKey(): string {
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  return monthStart.toISOString().slice(0, 10); // 'YYYY-MM-01'
}

function formatMonthLabel(monthStart: string): string {
  const d = new Date(`${monthStart}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function StatusPill({ status }: { status: InvoiceStatus }) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
  if (status === "paid") {
    return <span className={`${base} bg-green-100 text-green-800`}>Paid</span>;
  }
  if (status === "generated") {
    return (
      <span className={`${base} bg-amber-100 text-amber-800`}>
        Open (not paid)
      </span>
    );
  }
  return (
    <span className={`${base} bg-gray-100 text-gray-800`}>Not generated</span>
  );
}

export default async function TeacherDashboardPage() {
  const sb = await getServerSupabase();

  // 0) Map logged-in user → teacher_id
  const { data: u } = await sb.auth.getUser();
  const user = u?.user;
  if (!user) {
    return <p className="text-red-600">Please sign in.</p>;
  }

  const { data: t, error: teacherError } = await sb
    .from("teachers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (teacherError || !t?.id) {
    return (
      <p className="text-red-600">
        Error: teacher record not found for this login.
      </p>
    );
  }

  const teacherId = t.id;

  const invoiceMonthKey = getInvoiceMonthKey();
  const invoiceMonthLabel = formatMonthLabel(invoiceMonthKey);

  // 1) Pending lessons + invoice summary + assigned-student links
  const [
    { count: pendingCountRaw, error: pendingError },
    { data: invoiceSummaryData, error: invoiceError },
    { data: linkRows, error: linksError },
  ] = await Promise.all([
    sb
      .from("v_teacher_lessons")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", teacherId)
      .eq("state", "pending"),
    sb
      .from("v_teacher_invoice_summary")
      .select(
        "month_start, lesson_gross_pennies, expenses_pennies, total_pennies, status",
      )
      .eq("month_start", invoiceMonthKey)
      .maybeSingle(),
    sb
      .from("student_teacher")
      .select("student_id")
      .eq("teacher_id", teacherId),
  ]);

  const pendingCount = pendingCountRaw ?? 0;
  const invoiceSummary = (invoiceSummaryData ?? null) as InvoiceSummaryRow | null;

  const lessonGrossPennies = invoiceSummary?.lesson_gross_pennies ?? 0;
  const expensesPennies = invoiceSummary?.expenses_pennies ?? 0;
  const totalPennies =
    invoiceSummary?.total_pennies ?? lessonGrossPennies + expensesPennies;
  const invoiceStatus: InvoiceStatus =
    invoiceSummary?.status ?? "not_generated";

  // 2) Resolve current/dormant student counts from students.status
  let currentStudentsCount = 0;
  let dormantStudentsCount = 0;

  if (!linksError && linkRows && linkRows.length > 0) {
    const studentIds = Array.from(
      new Set(linkRows.map((r) => r.student_id).filter(Boolean)),
    ) as string[];

    if (studentIds.length > 0) {
      const { data: studentRows, error: studentsError } = await sb
        .from("students")
        .select("id, status")
        .in("id", studentIds);

      if (!studentsError && studentRows) {
        const typed = studentRows as StudentStatusRow[];
        currentStudentsCount = typed.filter(
          (s) => s.status === "current",
        ).length;
        dormantStudentsCount = typed.filter(
          (s) => s.status === "dormant",
        ).length;
      }
    }
  }

  return (
    <Section
      title="Teacher dashboard"
      subtitle="At-a-glance view of your lessons, students, and invoice month."
    >
      <div className="space-y-6">
        {/* Intro + primary action */}
        <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
          
          <Link
            href="/teacher/lessons/new"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            Log a new lesson
          </Link>
        </div>

        {/* Summary cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Lessons pending confirmation */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">
              Lessons pending confirmation
            </h2>
            <p className="mt-1 text-xs text-gray-600">
              Lessons you&apos;ve logged that are waiting for admin review.
            </p>

            {pendingError ? (
              <p className="mt-3 text-xs text-red-600">
                Couldn&apos;t load pending lessons.
              </p>
            ) : (
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-gray-900">
                  {pendingCount}
                </span>
                <span className="text-xs text-gray-600">
                  {pendingCount === 1 ? "lesson" : "lessons"}
                </span>
              </div>
            )}

            <Link
              href="/teacher/lessons"
              className="mt-3 inline-flex text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              View logged lessons
            </Link>
          </div>

          {/* Students: current / dormant */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">
              Your students
            </h2>
           

            {linksError ? (
              <p className="mt-3 text-xs text-red-600">
                Couldn&apos;t load student assignments.
              </p>
            ) : (
              <>
                <div className="mt-4 space-y-1 text-sm">
                  <div className="flex items-baseline justify-between">
                    <span className="text-gray-600">Current</span>
                    <span className="font-semibold text-gray-900">
                      {currentStudentsCount}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-gray-600">Dormant</span>
                    <span className="font-semibold text-gray-900">
                      {dormantStudentsCount}
                    </span>
                  </div>
                </div>
                <Link
                  href="/teacher/students"
                  className="mt-3 inline-flex text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  View student list
                </Link>
              </>
            )}
          </div>

          {/* Invoice month summary (previous month) */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Invoice month summary
                </h2>
                <p className="mt-1 text-xs text-gray-600">
                  Confirmed lesson earnings and approved expenses for{" "}
                  <span className="font-medium">{invoiceMonthLabel}</span>.
                </p>
              </div>
              <StatusPill status={invoiceStatus} />
            </div>

            {invoiceError ? (
              <p className="mt-3 text-xs text-red-600">
                Couldn&apos;t load invoice month summary.
              </p>
            ) : (
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex items-baseline justify-between">
                  <span className="text-gray-600">Lesson earnings</span>
                  <span className="font-semibold text-gray-900">
                    {formatPenniesAsPounds(lessonGrossPennies)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-gray-600">Expenses </span>
                  <span className="font-semibold text-gray-900">
                    {formatPenniesAsPounds(expensesPennies)}
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
                    Lessons + approved expenses for this invoice month. Pending
                    expenses will be included once approved by admin.
                  </p>
                </div>
              </div>
            )}

            <Link
              href="/teacher/invoices/current-month"
              className="mt-3 inline-flex text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              View full invoice breakdown
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}
