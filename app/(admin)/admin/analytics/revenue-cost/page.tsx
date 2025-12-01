import Section from "@/components/ui/Section";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  LessonMarginRow,
  buildTeacherSummary,
} from "@/lib/types/analytics";


// UI helpers – money & percentages
function formatPounds(pennies: number | null | undefined): string {
  if (pennies == null) return "£0.00";
  return `£${(pennies / 100).toFixed(2)}`;
}

function formatPct(pct: number | null | undefined): string {
  if (pct == null) return "—";
  return `${pct.toFixed(1)}%`;
}

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

export default async function ReportRevenueCost({
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
  const fromInput = getParam("from"); // "YYYY-MM-DD"
  const toInput = getParam("to"); // "YYYY-MM-DD"
  const teacherNameFilter = getParam("teacherName");
  const studentNameFilter = getParam("studentName");
  const delivery = getParam("delivery");
  const tier = getParam("tier");
  const lengthCat = getParam("lengthCat");

  const monthStart =
    monthInput && monthInput.length === 7 ? `${monthInput}-01` : undefined;

  const supabase = getAdminSupabase();

  // Base lesson query with filters applied
  let lessonQuery = supabase
    .from("v_lesson_margin_with_drinks_with_names")
    .select(
      `
      lesson_id,
      teacher_id,
      student_id,
      teacher_name,
      student_name,
      month_start,
      start_at,
      duration_min,
      delivery,
      revenue_pennies,
      teacher_earnings_pennies,
      margin_before_drinks_pennies,
      drinks_allocated_pennies,
      margin_after_drinks_pennies,
      margin_after_drinks_pct,
      student_tier,
      length_cat
    `
    );

  if (monthStart) {
    lessonQuery = lessonQuery.eq("month_start", monthStart);
  }
  if (fromInput) {
    // interpret as local date, compare against start_at
    lessonQuery = lessonQuery.gte("start_at", fromInput);
  }
  if (toInput) {
    // inclusive upper bound
    lessonQuery = lessonQuery.lte("start_at", `${toInput}T23:59:59`);
  }
  if (teacherNameFilter) {
    lessonQuery = lessonQuery.ilike("teacher_name", `%${teacherNameFilter}%`);
  }
  if (studentNameFilter) {
    lessonQuery = lessonQuery.ilike("student_name", `%${studentNameFilter}%`);
  }
  if (delivery === "online" || delivery === "f2f") {
    lessonQuery = lessonQuery.eq("delivery", delivery);
  }
  if (tier) {
    lessonQuery = lessonQuery.eq("student_tier", tier);
  }
  if (lengthCat) {
    lessonQuery = lessonQuery.eq("length_cat", lengthCat);
  }

  const { data: lessonData, error: lessonError } = await lessonQuery
    .order("month_start", { ascending: false })
    .order("margin_after_drinks_pennies", { ascending: true })
    .limit(500);

  const lessonRows = (lessonData ?? []) as LessonMarginRow[];

  // Aggregate lessonRows -> teacher × month summary (now via shared helper)
  const teacherRows = buildTeacherSummary(lessonRows);

  const tierLabel = (tiers: string[]) => {
    if (!tiers || tiers.length === 0) return "—";
    if (tiers.length === 1) return tiers[0];
    return "mixed";
  };

  const lengthLabel = (cats: string[]) => {
    if (!cats || cats.length === 0) return "—";
    if (cats.length === 1) return cats[0];
    return "mixed";
  };

  return (
    <Section
      title="Revenue vs cost"
      subtitle="Monthly revenue, teacher pay, drinks, and lesson-level margins."
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
          <label className="font-medium text-gray-700">From (date)</label>
          <input
            type="date"
            name="from"
            defaultValue={fromInput}
            className="rounded-md border px-2 py-1"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-700">To (date)</label>
          <input
            type="date"
            name="to"
            defaultValue={toInput}
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
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-700">Student name</label>
          <input
            type="text"
            name="studentName"
            defaultValue={studentNameFilter}
            className="rounded-md border px-2 py-1"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-gray-700">Delivery</label>
          <select
            name="delivery"
            defaultValue={delivery}
            className="rounded-md border px-2 py-1"
          >
            <option value="">Any</option>
            <option value="online">Online</option>
            <option value="f2f">F2F</option>
          </select>
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
          <label className="font-medium text-gray-700">Length cat</label>
          <select
            name="lengthCat"
            defaultValue={lengthCat}
            className="rounded-md border px-2 py-1"
          >
            <option value="">Any</option>
            <option value="60">60</option>
            <option value="90">90</option>
            <option value="120">120</option>
            <option value="none">none</option>
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
            href="/admin/reports/revenue-cost"
            className="text-xs text-gray-600 underline"
          >
            Reset
          </a>
        </div>
      </form>

      {/* Teacher-by-month summary (based on filtered lessons) */}
      {lessonError ? (
        <p className="mb-4 text-sm text-red-600">
          Failed to load margins: {lessonError.message}
        </p>
      ) : (
        <div className="mb-8 mt-2 overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">Month</th>
                <th className="px-3 py-2">Teacher</th>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2">Length cat</th>
                <th className="px-3 py-2">Lesson mins</th>
                <th className="px-3 py-2">Revenue</th>
                <th className="px-3 py-2">Teacher pay</th>
                <th className="px-3 py-2">Drinks (allocated)</th>
                <th className="px-3 py-2">Margin (before drinks)</th>
                <th className="px-3 py-2">Margin (after drinks)</th>
                <th className="px-3 py-2">% before drinks</th>
                <th className="px-3 py-2">% after drinks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {teacherRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-3 py-4 text-center text-sm text-gray-500"
                  >
                    No teacher-month data for this filter.
                  </td>
                </tr>
              ) : (
                teacherRows.map((row) => (
                  <tr key={`${row.teacher_id}-${row.month_start}`}>
                    <td className="px-3 py-2 align-top text-xs text-gray-700">
                      {row.month_start}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-gray-700">
                      {row.teacher_name || "—"}
                      <span className="ml-1 text-[10px] text-gray-400">
                        ({row.teacher_id.slice(0, 8)}…)
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-gray-700">
                      {tierLabel(row.tiers)}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-gray-700">
                      {lengthLabel(row.lengthCats)}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-gray-700">
                      {row.lesson_minutes_total}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-gray-700">
                      {formatPounds(row.revenue_pennies)}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-gray-700">
                      {formatPounds(row.teacher_earnings_pennies)}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-gray-700">
                      {formatPounds(row.drinks_allocated_pennies)}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-gray-700">
                      {formatPounds(row.margin_before_drinks_pennies)}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-gray-700">
                      {formatPounds(row.margin_after_drinks_pennies)}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-gray-700">
                      {formatPct(row.margin_before_drinks_pct)}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-gray-700">
                      {formatPct(row.margin_after_drinks_pct)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Lesson-level detail: worst margins after drinks (filtered) */}
      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-800">
          Lesson-level margins (worst {lessonRows.length} by margin after
          drinks)
        </h2>
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-gray-50 font-semibold uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">Month</th>
                <th className="px-3 py-2">Teacher</th>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">Delivery</th>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2">Length cat</th>
                <th className="px-3 py-2">Mins</th>
                <th className="px-3 py-2">Revenue</th>
                <th className="px-3 py-2">Teacher pay</th>
                <th className="px-3 py-2">Margin before drinks</th>
                <th className="px-3 py-2">Drinks allocated</th>
                <th className="px-3 py-2">Margin after drinks</th>
                <th className="px-3 py-2">% after drinks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lessonRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={13}
                    className="px-3 py-4 text-center text-xs text-gray-500"
                  >
                    No lesson-level data for this filter.
                  </td>
                </tr>
              ) : (
                lessonRows.map((row) => (
                  <tr key={row.lesson_id}>
                    <td className="px-3 py-2 align-top text-[11px] text-gray-700">
                      {row.month_start}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-gray-700">
                      {row.teacher_name || "—"}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-gray-700">
                      {row.student_name || "—"}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-gray-700">
                      {row.delivery}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-gray-700">
                      {row.student_tier || "—"}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-gray-700">
                      {row.length_cat || "—"}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-gray-700">
                      {row.duration_min}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-gray-700">
                      {formatPounds(row.revenue_pennies)}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-gray-700">
                      {formatPounds(row.teacher_earnings_pennies)}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-gray-700">
                      {formatPounds(row.margin_before_drinks_pennies)}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-gray-700">
                      {formatPounds(row.drinks_allocated_pennies)}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-gray-700">
                      {formatPounds(row.margin_after_drinks_pennies)}
                    </td>
                    <td className="px-3 py-2 align-top text-[11px] text-gray-700">
                      {formatPct(row.margin_after_drinks_pct)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}
