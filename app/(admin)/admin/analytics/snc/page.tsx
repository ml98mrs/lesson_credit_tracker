// app/(admin)/admin/analytics/snc/page.tsx

import Section from "@/components/ui/Section";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { formatPenniesAsPounds } from "@/lib/formatters";
import { TIER_VALUES, formatTierFilterLabel } from "@/lib/domain/tiers";
import type {Tier,} from "@/lib/enums";

export const dynamic = "force-dynamic";

type SncStatsRow = {
  month_start: string;
  teacher_id: string;
  teacher_name: string | null;
  student_id: string;
  student_name: string | null;
  student_tier: string | null;

  lesson_count_total: number | null;
  lesson_minutes_total: number | null;

  snc_lesson_count: number | null;
  snc_minutes_total: number | null;

  free_snc_lesson_count: number | null;
  free_snc_minutes_total: number | null;

  charged_snc_lesson_count: number | null;
  charged_snc_minutes_total: number | null;

  snc_rate_pct: number | null;

  free_snc_revenue_pennies: number | null;
  free_snc_teacher_pay_pennies: number | null;
  charged_snc_revenue_pennies: number | null;
  charged_snc_teacher_pay_pennies: number | null;
};

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

function formatPct(p: number | null | undefined) {
  if (p == null) return "—";
  return `${p.toFixed(1)}%`;
}

function formatMinutes(m: number | null | undefined) {
  return m ?? 0;
}

export default async function SncAnalyticsPage({
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

  const monthInput = getParam("month"); // "YYYY-MM"
  const teacherNameFilter = getParam("teacherName");
  const studentNameFilter = getParam("studentName");
  const tier = getParam("tier");

  const monthStart =
    monthInput && monthInput.length === 7 ? `${monthInput}-01` : undefined;

  const supabase = getAdminSupabase();

  let query = supabase
    .from("v_snc_stats_by_month_with_names")
    .select(
      `
      month_start,
      teacher_id,
      teacher_name,
      student_id,
      student_name,
      student_tier,
      lesson_count_total,
      lesson_minutes_total,
      snc_lesson_count,
      snc_minutes_total,
      free_snc_lesson_count,
      free_snc_minutes_total,
      charged_snc_lesson_count,
      charged_snc_minutes_total,
      snc_rate_pct,
      free_snc_revenue_pennies,
      free_snc_teacher_pay_pennies,
      charged_snc_revenue_pennies,
      charged_snc_teacher_pay_pennies
    `
    );

  if (monthStart) {
    query = query.eq("month_start", monthStart);
  }

  if (teacherNameFilter) {
    query = query.ilike("teacher_name", `%${teacherNameFilter}%`);
  }

  if (studentNameFilter) {
    query = query.ilike("student_name", `%${studentNameFilter}%`);
  }

  if (tier) {
    query = query.eq("student_tier", tier);
  }

  const { data, error } = await query
    .order("month_start", { ascending: false })
    .order("teacher_name", { ascending: true })
    .order("student_name", { ascending: true })
    .limit(500);

  const rows = (data ?? []) as SncStatsRow[];

  return (
    <Section
      title="SNC & cancellation behaviour"
      subtitle="Short-notice cancellations by month, teacher, student, and tier – including revenue impact."
    >
      {/* Filters */}
      <form
        method="GET"
        className="mb-4 grid gap-3 rounded-lg border bg-white p-3 text-xs md:grid-cols-4 lg:grid-cols-6"
      >
        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-700">Month</label>
          <input
            type="month"
            name="month"
            defaultValue={monthInput}
            className="rounded-md border px-2 py-1"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-700">Teacher name</label>
          <input
            type="text"
            name="teacherName"
            defaultValue={teacherNameFilter}
            className="rounded-md border px-2 py-1"
            placeholder="e.g. Sato"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-700">Student name</label>
          <input
            type="text"
            name="studentName"
            defaultValue={studentNameFilter}
            className="rounded-md border px-2 py-1"
            placeholder="e.g. Tanaka"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-700">Tier</label>
          <select
  name="tier"
  defaultValue={tier}
  className="rounded-md border px-2 py-1"
>
  {(["", ...TIER_VALUES] as const).map((v) => (
    <option key={v} value={v}>
      {formatTierFilterLabel(v as "" | Tier)}
    </option>
  ))}
</select>
        </div>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded-md bg-black px-3 py-1 text-xs font-semibold text-white"
          >
            Apply
          </button>
          <a
            href="/admin/analytics/snc"
            className="text-xs text-gray-600 underline"
          >
            Reset
          </a>
        </div>
      </form>

      {error && (
        <p className="mb-4 text-sm text-red-600">
          Failed to load SNC stats: {error.message}
        </p>
      )}

      <div className="mb-4 text-xs text-gray-600">
        Each row = <strong>(month, teacher, student, tier)</strong>. You can see
        SNC rate, free vs charged SNC minutes, and £ impact.
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-gray-50 font-semibold uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2">Month</th>
              <th className="px-3 py-2">Teacher</th>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Tier</th>
              <th className="px-3 py-2">Lessons</th>
              <th className="px-3 py-2">SNC lessons</th>
              <th className="px-3 py-2">SNC rate</th>
              <th className="px-3 py-2">Free SNC mins</th>
              <th className="px-3 py-2">Charged SNC mins</th>
              <th className="px-3 py-2">Free SNC £ (rev)</th>
              <th className="px-3 py-2">Free SNC £ (teacher)</th>
              <th className="px-3 py-2">Charged SNC £ (rev)</th>
              <th className="px-3 py-2">Charged SNC £ (teacher)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={13}
                  className="px-3 py-4 text-center text-xs text-gray-500"
                >
                  No SNC data found for this filter.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={`${row.month_start}-${row.teacher_id}-${row.student_id}`}
                >
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {row.month_start}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {row.teacher_name || "—"}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {row.student_name || "—"}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {row.student_tier ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {row.lesson_count_total ?? 0}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {row.snc_lesson_count ?? 0}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {formatPct(row.snc_rate_pct)}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {formatMinutes(row.free_snc_minutes_total)}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {formatMinutes(row.charged_snc_minutes_total)}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {formatPenniesAsPounds(
                      row.free_snc_revenue_pennies ?? 0,
                    )}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {formatPenniesAsPounds(
                      row.free_snc_teacher_pay_pennies ?? 0,
                    )}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {formatPenniesAsPounds(
                      row.charged_snc_revenue_pennies ?? 0,
                    )}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-700">
                    {formatPenniesAsPounds(
                      row.charged_snc_teacher_pay_pennies ?? 0,
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
