// app/(admin)/admin/analytics/cohorts/page.tsx

import Section from "@/components/ui/Section";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { formatMinutesAsHours } from "@/lib/formatters";

type CohortSummaryRow = {
  cohort_month: string;
  student_tier: string | null;
  first_teacher_id: string | null;
  first_teacher_name: string | null;
  cohort_size: number;

  active_0_3m_count: number;
  active_0_6m_count: number;
  active_0_12m_count: number;
  active_0_3m_pct: number;
  active_0_6m_pct: number;
  active_0_12m_pct: number;

  minutes_0_3m_total: number | null;
  minutes_0_6m_total: number | null;
  minutes_0_12m_total: number | null;
  minutes_0_3m_avg: number | null;
  minutes_0_6m_avg: number | null;
  minutes_0_12m_avg: number | null;

  reactivated_count: number;
};

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

function formatPct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
}

export const dynamic = "force-dynamic";

export default async function CohortReportPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = ((await searchParams) ?? {}) as SearchParams;

  const getParam = (key: string) => {
    const val = sp[key];
    if (Array.isArray(val)) return val[0] ?? "";
    return val ?? "";
  };

  const cohortMonth = getParam("cohortMonth"); // "YYYY-MM"
  const tier = getParam("tier");
  const teacherName = getParam("teacherName");

  const supabase = getAdminSupabase();

  let query = supabase
    .from("v_student_cohort_summary")
    .select(
      `
      cohort_month,
      student_tier,
      first_teacher_id,
      first_teacher_name,
      cohort_size,
      active_0_3m_count,
      active_0_6m_count,
      active_0_12m_count,
      active_0_3m_pct,
      active_0_6m_pct,
      active_0_12m_pct,
      minutes_0_3m_total,
      minutes_0_6m_total,
      minutes_0_12m_total,
      minutes_0_3m_avg,
      minutes_0_6m_avg,
      minutes_0_12m_avg,
      reactivated_count
    `
    );

  if (cohortMonth && cohortMonth.length === 7) {
    query = query.eq("cohort_month", `${cohortMonth}-01`);
  }

  if (tier) {
    query = query.eq("student_tier", tier);
  }

  if (teacherName) {
    query = query.ilike("first_teacher_name", `%${teacherName}%`);
  }

  const { data, error } = await query
    .order("cohort_month", { ascending: false })
    .order("first_teacher_name", { ascending: true });

  const rows = (data ?? []) as CohortSummaryRow[];

  return (
    <Section
      title="Student cohorts & reactivation"
      subtitle="Track new-student cohorts, retention over time, and reactivation behaviour."
    >
      {/* tiny red accent to match your analytics panel */}
      <div className="mb-4 h-1 w-16 rounded-full bg-red-600" />

      {/* Filters */}
      <form
        method="GET"
        className="mb-4 grid gap-3 rounded-lg border bg-white p-3 text-xs md:grid-cols-4"
      >
        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-700">
            Cohort month (first lesson)
          </label>
          <input
            type="month"
            name="cohortMonth"
            defaultValue={cohortMonth}
            className="rounded-md border px-2 py-1"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-700">Tier</label>
          <select
            name="tier"
            defaultValue={tier}
            className="rounded-md border px-2 py-1"
          >
            <option value="">Any</option>
            <option value="basic">basic</option>
            <option value="premium">premium</option>
            <option value="elite">elite</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-700">First teacher name</label>
          <input
            type="text"
            name="teacherName"
            defaultValue={teacherName}
            className="rounded-md border px-2 py-1"
          />
        </div>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded-md bg-black px-3 py-1 text-xs font-semibold text-white"
          >
            Apply
          </button>
          <a
            href="/admin/reports/cohorts"
            className="text-xs text-gray-600 underline"
          >
            Reset
          </a>
        </div>
      </form>

      {error ? (
        <p className="mb-4 text-sm text-red-600">
          Failed to load cohort stats: {error.message}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-gray-50 font-semibold uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">Cohort month</th>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2">First teacher</th>
                <th className="px-3 py-2">Cohort size</th>

                <th className="px-3 py-2">Active @3m</th>
                <th className="px-3 py-2">Active @6m</th>
                <th className="px-3 py-2">Active @12m</th>

                <th className="px-3 py-2">Avg hours 0–3m</th>
                <th className="px-3 py-2">Avg hours 0–6m</th>
                <th className="px-3 py-2">Avg hours 0–12m</th>

                <th className="px-3 py-2">Reactivated (proxy)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-3 py-4 text-center text-xs text-gray-500"
                  >
                    No cohort data for this filter.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={`${row.cohort_month}-${row.first_teacher_id}-${row.student_tier ?? "any"}`}>
                    <td className="px-3 py-2 text-[11px] text-gray-700">
                      {row.cohort_month}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-700">
                      {row.student_tier ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-700">
                      {row.first_teacher_name || "—"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-700">
                      {row.cohort_size}
                    </td>

                    <td className="px-3 py-2 text-[11px] text-gray-700">
                      {row.active_0_3m_count}/{row.cohort_size} (
                      {formatPct(row.active_0_3m_pct)})
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-700">
                      {row.active_0_6m_count}/{row.cohort_size} (
                      {formatPct(row.active_0_6m_pct)})
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-700">
                      {row.active_0_12m_count}/{row.cohort_size} (
                      {formatPct(row.active_0_12m_pct)})
                    </td>

                    <td className="px-3 py-2 text-[11px] text-gray-700">
                      {row.minutes_0_3m_avg != null
                        ? `${formatMinutesAsHours(row.minutes_0_3m_avg)} h`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-700">
                      {row.minutes_0_6m_avg != null
                        ? `${formatMinutesAsHours(row.minutes_0_6m_avg)} h`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-700">
                      {row.minutes_0_12m_avg != null
                        ? `${formatMinutesAsHours(row.minutes_0_12m_avg)} h`
                        : "—"}
                    </td>

                    <td className="px-3 py-2 text-[11px] text-gray-700">
                      {row.reactivated_count}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
