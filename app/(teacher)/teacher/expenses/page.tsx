// app/(teacher)/teacher/expenses/page.tsx
import Link from "next/link";
import Section from "@/components/ui/Section";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  formatPenniesAsPounds,
  formatDateLondon,
} from "@/lib/formatters";
import DeleteExpenseButton from "@/components/teacher/DeleteExpenseButton";

type ExpenseSummaryRow = {
  month_start: string; // date (YYYY-MM-01)
  approved_pennies: number | null;
  pending_pennies: number | null;
  rejected_pennies: number | null;
};

type ExpenseStatus = "pending" | "approved" | "rejected" | string;

type ExpenseRow = {
  id: number;
  incurred_at: string;
  amount_pennies: number;
  status: ExpenseStatus;
  description: string | null;
  category: "drinks" | "teaching_resources" | "other";
  student_id: string | null;
};

type StudentNameRow = {
  student_id: string;
  full_name: string;
};

export const dynamic = "force-dynamic";

export default async function TeacherExpensesPage() {
  const supabase = await getServerSupabase();

  const { data: summaries, error: summaryError } = await supabase
    .from("v_teacher_expenses_summary")
    .select("month_start, approved_pennies, pending_pennies, rejected_pennies")
    .order("month_start", { ascending: false })
    .limit(6);

  const { data: expenses, error: expensesError } = await supabase
    .from("teacher_expenses")
    .select(
      "id, incurred_at, amount_pennies, status, description, category, student_id",
    )
    .order("incurred_at", { ascending: false })
    .limit(20);

  const summaryRows = (summaries ?? []) as ExpenseSummaryRow[];
  const expenseRows = (expenses ?? []) as ExpenseRow[];

  // Look up student names for any rows linked to a student
  const studentIds = Array.from(
    new Set(expenseRows.map((e) => e.student_id).filter(Boolean)),
  ) as string[];

  const studentNameById = new Map<string, string>();

  if (studentIds.length > 0) {
    const { data: studentNames } = await supabase
      .from("v_student_names")
      .select("student_id, full_name")
      .in("student_id", studentIds);

    for (const sn of (studentNames ?? []) as StudentNameRow[]) {
      studentNameById.set(sn.student_id, sn.full_name);
    }
  }

  function formatCategory(cat: ExpenseRow["category"]) {
    if (cat === "drinks") return "Drinks";
    if (cat === "teaching_resources") return "Teaching resources";
    return "Other";
  }

  return (
    <Section
      title="My expenses"
      subtitle="Log expenses and see what’s been approved for your invoices."
    >
      {/* 🔗 Link to add a new expense */}
      <div className="mb-4 flex justify-end">
        <Link
          href="/teacher/expenses/new"
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          + Log new expense
        </Link>
      </div>

      <div className="space-y-8">
        {/* Monthly summary */}
        <div>
          <h2 className="text-sm font-semibold text-gray-800">
            Monthly summary
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Totals per calendar month. Only <strong>approved</strong> expenses
            are included in your invoices.
          </p>

          <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Month
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Approved
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Pending
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Rejected
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {summaryRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-4 text-center text-xs text-gray-500"
                    >
                      No expenses logged yet.
                    </td>
                  </tr>
                ) : (
                  summaryRows.map((row) => {
                    const d = new Date(row.month_start);
                    const monthLabel = d.toLocaleDateString("en-GB", {
                      month: "short",
                      year: "numeric",
                    });

                    return (
                      <tr key={row.month_start}>
                        <td className="px-3 py-2 text-sm text-gray-800">
                          {monthLabel}
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-gray-900">
                          {formatPenniesAsPounds(row.approved_pennies)}
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-gray-900">
                          {formatPenniesAsPounds(row.pending_pennies)}
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-gray-900">
                          {formatPenniesAsPounds(row.rejected_pennies)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent expense claims */}
        <div>
          <h2 className="text-sm font-semibold text-gray-800">
            Recent expense claims
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            New expenses start as <strong>pending</strong>. Admin will review
            and mark them as approved or rejected. Pending items can be deleted.
          </p>

          <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Incurred
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Student
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Category
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Amount
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {/* Actions */}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {expenseRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-4 text-center text-xs text-gray-500"
                    >
                      No expenses logged yet.
                    </td>
                  </tr>
                ) : (
                  expenseRows.map((e) => (
                    <tr key={e.id}>
                      <td className="px-3 py-2 text-sm text-gray-800">
                        {formatDateLondon(e.incurred_at)}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-800">
                        {e.student_id
                          ? studentNameById.get(e.student_id) ?? "Unknown student"
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-800">
                        {formatCategory(e.category)}
                      </td>
                      <td className="px-3 py-2 text-right text-sm text-gray-900">
                        {formatPenniesAsPounds(e.amount_pennies)}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <span
                          className={[
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            e.status === "approved"
                              ? "bg-green-50 text-green-700 ring-1 ring-green-600/20"
                              : e.status === "rejected"
                              ? "bg-red-50 text-red-700 ring-1 ring-red-600/20"
                              : "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20",
                          ].join(" ")}
                        >
                          {e.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-sm">
                        {e.status === "pending" && (
                          <DeleteExpenseButton expenseId={e.id} />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {(summaryError || expensesError) && (
            <p className="mt-2 text-xs text-red-600">
              There was a problem loading your expenses. Try refreshing or
              contact admin if this continues.
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}
