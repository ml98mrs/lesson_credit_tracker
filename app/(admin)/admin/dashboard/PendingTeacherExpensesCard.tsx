// app/(admin)/admin/dashboard/PendingTeacherExpensesCard.tsx
import Link from "next/link";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  formatPenniesAsPounds,
  formatDateTimeLondon,
} from "@/lib/formatters";

type PendingExpenseRow = {
  id: number;
  teacher_id: string;
  month_start: string;
  incurred_at: string;
  amount_pennies: number;
};

export default async function PendingTeacherExpensesCard() {
  const supabase = await getAdminSupabase();

  // 1) Get latest pending expenses
  const { data: pendingExpenses, error } = await supabase
    .from("v_teacher_expenses_detail_by_month")
    .select(
      "id, teacher_id, month_start, incurred_at, amount_pennies, status",
    )
    .eq("status", "pending")
    .order("incurred_at", { ascending: false })
    .limit(10);

  if (error || !pendingExpenses || pendingExpenses.length === 0) {
    // No pending expenses = no card
    return null;
  }

  const rows = pendingExpenses as PendingExpenseRow[];

  // 2) Look up teacher names in bulk (teachers → profiles)
  const teacherIds = Array.from(new Set(rows.map((r) => r.teacher_id)));

  const { data: teacherRows } = await supabase
    .from("teachers")
    .select("id, profile_id")
    .in("id", teacherIds);

  const profileIds = Array.from(
    new Set(
      (teacherRows ?? [])
        .map((t) => t.profile_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", profileIds);

  const teacherNameById = new Map<string, string>();

  for (const t of teacherRows ?? []) {
    const profile = profiles?.find((p) => p.id === t.profile_id);
    teacherNameById.set(t.id, profile?.full_name ?? t.id);
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-amber-900">
          Pending teacher expenses
        </h2>
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-900">
          {rows.length}
        </span>
      </div>

      <p className="mb-3 text-[11px] text-amber-900">
        New expense claims logged by teachers. Review them on the invoice page
        and approve or reject.
      </p>

      <ul className="space-y-2 text-xs text-amber-900">
        {rows.map((row) => {
          const teacherName =
            teacherNameById.get(row.teacher_id) ?? row.teacher_id;

          return (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-white/80 px-2 py-1.5"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{teacherName}</div>
                <div className="flex flex-wrap gap-1 text-[11px] text-amber-800">
                  <span>{formatPenniesAsPounds(row.amount_pennies)}</span>
                  <span>·</span>
                  <span>{formatDateTimeLondon(row.incurred_at)}</span>
                </div>
              </div>

              <Link
                href={`/admin/teachers/${row.teacher_id}/invoices`}
                className="whitespace-nowrap rounded-md bg-amber-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-amber-700"
              >
                Review
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
