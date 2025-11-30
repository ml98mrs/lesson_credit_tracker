// app/(teacher)/teacher/students/[studentId]/page.tsx

import Link from "next/link";

import Section from "@/components/ui/Section";
import { CreditSnapshot } from "@/components/credit/CreditSnapshot";

import { getServerSupabase } from "@/lib/supabase/server";
import {
  formatDateTimeLondon,
  formatPenniesAsPounds,
} from "@/lib/formatters";
import type { LessonState, SncMode, Delivery } from "@/lib/enums";
import { loadStudentDashboard } from "@/lib/api/student/dashboard";
import { buildAwardLine } from "@/lib/awardReasons";

export const dynamic = "force-dynamic";

type StudentNameRow = {
  student_name: string | null;
};

type LessonEarningRow = {
  lesson_id: string;
  start_at: string;
  duration_min: number;
  delivery: Delivery;
  state: LessonState;
  is_snc: boolean;
  snc_mode: SncMode | null;
  gross_pennies: number | null;
};

type StudentDashboardData = Awaited<
  ReturnType<typeof loadStudentDashboard>
>;

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

type TeacherCreditSnapshot = {
  purchasedMin: number;
  awardedMin: number;
  usedMin: number;
  remainingMin: number;
  purchasedOnlineMin: number;
  purchasedF2fMin: number;
  usedOnlineMin: number;
  usedF2fMin: number;
  remainingOnlineMin: number;
  remainingF2fMin: number;
  hasBothDeliveries: boolean;
  generatedAtLabel: string;
  awardedLine: string | null;
  usedAwardLine: string | null;
  remainingAwardLine: string | null;
};

function getSncLabel(lesson: LessonEarningRow): string {
  if (!lesson.is_snc) return "No";

  if (lesson.snc_mode === "free") return "SNC (free)";
  if (lesson.snc_mode === "charged") return "SNC (charged)";

  return "SNC";
}

export default async function TeacherStudentDetail(props: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { studentId } = await props.params; // Next 16: params as Promise
  const sp = await props.searchParams;

  const supabase = await getServerSupabase();

  // -------------------------------------------------------------------------
  // Map logged-in user → teacher_id (explicit teacher scoping)
  // -------------------------------------------------------------------------
  const { data: u } = await supabase.auth.getUser();
  const user = u?.user;

  if (!user) {
    return (
      <Section
        title="Student detail"
        subtitle="Summary, credit snapshot, and recent lessons with this student."
      >
        <p className="text-sm text-gray-600">
          Please sign in as a teacher to view this page.
        </p>
      </Section>
    );
  }

  const { data: t, error: teacherError } = await supabase
    .from("teachers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (teacherError || !t?.id) {
    return (
      <Section
        title="Student detail"
        subtitle="Summary, credit snapshot, and recent lessons with this student."
      >
        <p className="text-sm text-red-600">
          Error: teacher record not found for this login.
        </p>
      </Section>
    );
  }

  const teacherId = t.id as string;

  const getParam = (key: string): string =>
    typeof sp[key] === "string" ? (sp[key] as string) : "";

  // Filters
  const monthParam = getParam("month"); // "1".."12"
  const yearParam = getParam("year"); // "2024" etc.
  const fromParam = getParam("from"); // "yyyy-mm-dd"
  const toParam = getParam("to"); // "yyyy-mm-dd"
  const deliveryFilter = getParam("delivery"); // "", "online", "f2f"
  const sncFilter = getParam("snc"); // "", "snc", "non_snc", "free", "charged"

  // Build date bounds
  let fromIso: string | undefined;
  let toIso: string | undefined;

  if (monthParam && yearParam) {
    // Month/year filter takes precedence over from/to
    const month = Number(monthParam) - 1; // JS months 0–11
    const year = Number(yearParam);

    if (!Number.isNaN(month) && !Number.isNaN(year)) {
      const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
      const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0)); // exclusive
      fromIso = start.toISOString();
      toIso = end.toISOString();
    }
  } else {
    if (fromParam) {
      const fromDate = new Date(fromParam + "T00:00:00.000Z");
      fromIso = fromDate.toISOString();
    }
    if (toParam) {
      // inclusive up to end of day
      const toDate = new Date(toParam + "T23:59:59.999Z");
      toIso = toDate.toISOString();
    }
  }

  const [
    { data: studentNameRow, error: studentNameError },
    lessonsResult,
    studentDashboardResult,
  ] = await Promise.all([
    // Get a display name from v_teacher_lessons (teacher-safe, known columns)
    supabase
      .from("v_teacher_lessons")
      .select("student_name")
      .eq("teacher_id", teacherId)
      .eq("student_id", studentId)
      .order("start_at", { ascending: false })
      .limit(1)
      .maybeSingle<StudentNameRow>(),
    // Per-lesson earnings from v_teacher_lesson_earnings_detail
    (async () => {
      let query = supabase
        .from("v_teacher_lesson_earnings_detail")
        .select(
          "lesson_id, start_at, duration_min, delivery, state, is_snc, snc_mode, gross_pennies",
        )
        .eq("teacher_id", teacherId)
        .eq("student_id", studentId);

      // Apply date filters
      if (fromIso) {
        query = query.gte("start_at", fromIso);
      }
      if (toIso) {
        query = query.lt("start_at", toIso);
      }

      // Apply delivery filter
      if (deliveryFilter === "online" || deliveryFilter === "f2f") {
        query = query.eq("delivery", deliveryFilter as Delivery);
      }

      // Apply SNC filter
      switch (sncFilter) {
        case "snc":
          query = query.eq("is_snc", true);
          break;
        case "non_snc":
          query = query.eq("is_snc", false);
          break;
        case "free":
          query = query.eq("is_snc", true).eq("snc_mode", "free");
          break;
        case "charged":
          query = query.eq("is_snc", true).eq("snc_mode", "charged");
          break;
        default:
          break;
      }

      // Most recent first, cap at 20
      return query
        .order("start_at", { ascending: false })
        .limit(20)
        .returns<LessonEarningRow[]>();
    })(),
    // Student credit snapshot (reuse student dashboard helper)
    (async () => {
      try {
        const data = await loadStudentDashboard(studentId);
        return { data, error: null as null | string };
      } catch (e) {
        const err = e as Error;
        return {
          data: null as StudentDashboardData | null,
          error: err.message,
        };
      }
    })(),
  ]);

  const { data: lessonRows, error: lessonsError } = lessonsResult;
  const studentName = studentNameRow?.student_name || "Student";

  const studentDashboardData = studentDashboardResult.data;
  const studentDashboardError = studentDashboardResult.error;

  // Count of lessons currently shown (one row = one lesson)
  const lessonCount =
    !lessonsError && Array.isArray(lessonRows) ? lessonRows.length : 0;

  // For sticky filter UI
  const monthDefault = monthParam;
  const yearDefault = yearParam;
  const fromDefault = fromParam;
  const toDefault = toParam;

  // Derived credit snapshot (if we successfully loaded it)
  let creditSnapshot: TeacherCreditSnapshot | null = null;

  if (studentDashboardData) {
    const {
      usedMin,
      remainingMin,
      deliverySummary,
      generatedAtIso,
      awardReasons,
    } = studentDashboardData;

    const {
      purchasedMin,
      awardedMin,
      usedMin: usedMinFromDelivery,
      remainingMin: remainingMinFromDelivery,
      purchasedOnlineMin,
      purchasedF2fMin,
      usedOnlineMin,
      usedF2fMin,
      remainingOnlineMin,
      remainingF2fMin,
    } = deliverySummary;

    const usedTotalMin = usedMin ?? usedMinFromDelivery ?? 0;
    const remainingTotalMin = remainingMin ?? remainingMinFromDelivery ?? 0;
    const hasBothDeliveries =
      purchasedOnlineMin > 0 && purchasedF2fMin > 0;

    // Award reason lines (same pattern as student dashboard)
    const awardRowsForLines = awardReasons.map((r) => ({
      award_reason_code: r.awardReasonCode,
      granted_award_min: r.grantedAwardMin,
      used_award_min: r.usedAwardMin,
      remaining_award_min: r.remainingAwardMin,
    }));

    const awardedLine = buildAwardLine(awardRowsForLines, "granted");
    const usedAwardLine = buildAwardLine(awardRowsForLines, "used");
    const remainingAwardLine = buildAwardLine(
      awardRowsForLines,
      "remaining",
    );

    creditSnapshot = {
      purchasedMin,
      awardedMin,
      usedMin: usedTotalMin,
      remainingMin: remainingTotalMin,
      purchasedOnlineMin,
      purchasedF2fMin,
      usedOnlineMin,
      usedF2fMin,
      remainingOnlineMin,
      remainingF2fMin,
      hasBothDeliveries,
      generatedAtLabel: formatDateTimeLondon(generatedAtIso),
      awardedLine,
      usedAwardLine,
      remainingAwardLine,
    };
  }

  return (
    <Section
      title={`Student: ${studentName}`}
      subtitle="Summary, credit snapshot, and recent lessons with this student."
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-sm">
            {studentNameError && (
              <p className="text-xs text-red-600">
                We couldn&apos;t load this student&apos;s name; using a
                generic label instead.
              </p>
            )}
            {!studentNameError && (
              <p className="text-gray-700">
                You&apos;re viewing lessons, earnings, and credit for{" "}
                <span className="font-semibold">{studentName}</span>.
              </p>
            )}
            <p className="text-xs text-gray-500">
              This page is your teacher view of a single student: what you&apos;ve
              logged, how much you&apos;re paid, and roughly what they see on
              their own dashboard.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-xs text-gray-600 sm:items-end">
            <Link
              href="/teacher/students"
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              ← Back to student list
            </Link>
          </div>
        </div>

        {/* CREDIT SNAPSHOT (teacher view of student dashboard) */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Credit snapshot (student view)
                </h2>
                <p className="mt-1 text-xs text-gray-600">
                  A simplified view of what this student sees on their own
                  dashboard: how many hours they&apos;ve purchased, used, and
                  have remaining.
                </p>
              </div>
              {creditSnapshot && (
                <div className="text-[11px] text-gray-500">
                  Snapshot as of{" "}
                  <span className="font-semibold">
                    {creditSnapshot.generatedAtLabel}
                  </span>
                </div>
              )}
            </div>
          </div>

          {!studentDashboardData && (
            <div className="px-4 py-3 text-xs text-gray-600">
              Credit summary is currently unavailable for this student.
              {studentDashboardError && (
                <>
                  {" "}
                  <span className="text-[10px] text-red-500">
                    ({studentDashboardError})
                  </span>
                </>
              )}
            </div>
          )}

          {studentDashboardData && creditSnapshot && (
            <div className="px-4 py-3">
              <CreditSnapshot
                purchasedMin={creditSnapshot.purchasedMin}
                awardedMin={creditSnapshot.awardedMin}
                usedMin={creditSnapshot.usedMin}
                remainingMin={creditSnapshot.remainingMin}
                purchasedOnlineMin={creditSnapshot.purchasedOnlineMin}
                purchasedF2fMin={creditSnapshot.purchasedF2fMin}
                usedOnlineMin={creditSnapshot.usedOnlineMin}
                usedF2fMin={creditSnapshot.usedF2fMin}
                remainingOnlineMin={creditSnapshot.remainingOnlineMin}
                remainingF2fMin={creditSnapshot.remainingF2fMin}
                hasBothDeliveries={creditSnapshot.hasBothDeliveries}
                awardedLine={creditSnapshot.awardedLine}
                usedAwardLine={creditSnapshot.usedAwardLine}
                remainingAwardLine={creditSnapshot.remainingAwardLine}
              />
            </div>
          )}
        </div>

        {/* Recent lessons + earnings */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Recent lessons &amp; earnings
                </h2>
                <p className="mt-1 text-xs text-gray-600">
                  Up to 20 most recent lessons you&apos;ve logged with this
                  student. Earnings are calculated in the database from your
                  effective rates.
                </p>
              </div>
              <div className="text-[11px] text-gray-500">
                Showing{" "}
                <span className="font-semibold">
                  {lessonCount}
                </span>{" "}
                lesson{lessonCount === 1 ? "" : "s"}
                {monthParam ||
                yearParam ||
                fromParam ||
                toParam ||
                deliveryFilter ||
                sncFilter
                  ? " (filtered)"
                  : ""}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="border-b px-4 py-3">
            <form
              method="get"
              className="flex flex-wrap items-end gap-3 text-xs"
            >
              {/* Month/year filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-gray-500">Month</span>
                <select
                  name="month"
                  defaultValue={monthDefault}
                  className="h-7 rounded border px-2 text-xs"
                >
                  <option value="">Any</option>
                  <option value="1">Jan</option>
                  <option value="2">Feb</option>
                  <option value="3">Mar</option>
                  <option value="4">Apr</option>
                  <option value="5">May</option>
                  <option value="6">Jun</option>
                  <option value="7">Jul</option>
                  <option value="8">Aug</option>
                  <option value="9">Sep</option>
                  <option value="10">Oct</option>
                  <option value="11">Nov</option>
                  <option value="12">Dec</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-gray-500">Year</span>
                <input
                  name="year"
                  type="number"
                  min="2000"
                  max="2100"
                  defaultValue={yearDefault}
                  className="h-7 w-20 rounded border px-2 text-xs"
                  placeholder="YYYY"
                />
              </div>

              {/* From / to date range */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-gray-500">From date</span>
                <input
                  name="from"
                  type="date"
                  defaultValue={fromDefault}
                  className="h-7 rounded border px-2 text-xs"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-gray-500">To date</span>
                <input
                  name="to"
                  type="date"
                  defaultValue={toDefault}
                  className="h-7 rounded border px-2 text-xs"
                />
              </div>

              {/* Delivery filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-gray-500">Delivery</span>
                <select
                  name="delivery"
                  defaultValue={deliveryFilter}
                  className="h-7 rounded border px-2 text-xs"
                >
                  <option value="">Any</option>
                  <option value="online">Online</option>
                  <option value="f2f">Face to face</option>
                </select>
              </div>

              {/* SNC filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-gray-500">SNC</span>
                <select
                  name="snc"
                  defaultValue={sncFilter}
                  className="h-7 rounded border px-2 text-xs"
                >
                  <option value="">All</option>
                  <option value="snc">SNC only</option>
                  <option value="non_snc">Non-SNC only</option>
                  <option value="free">Free SNC only</option>
                  <option value="charged">Charged SNC only</option>
                </select>
              </div>

              <button
                type="submit"
                className="h-7 rounded border px-3 text-xs font-medium"
              >
                Apply
              </button>
            </form>

            <p className="mt-1 text-[10px] text-gray-500">
              If both month/year and a date range are set, the month/year
              filter takes precedence.
            </p>
          </div>

          {lessonsError && (
            <div className="px-4 py-3 text-xs text-red-600">
              Couldn&apos;t load lesson history. Please try again later.
            </div>
          )}

          {!lessonsError && (!lessonRows || lessonRows.length === 0) && (
            <div className="px-4 py-3 text-sm text-gray-500">
              No lessons recorded yet with this student for the selected
              filters.
            </div>
          )}

          {!lessonsError && lessonRows && lessonRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      Date &amp; time
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      Delivery
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      Length (min)
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      SNC
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">
                      Status
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">
                      Earnings
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {lessonRows.map((lesson) => {
                    const earningsCell =
                      lesson.gross_pennies == null
                        ? "—"
                        : formatPenniesAsPounds(lesson.gross_pennies);

                    const deliveryLabel =
                      lesson.delivery === "online"
                        ? "Online"
                        : lesson.delivery === "f2f"
                        ? "Face to face"
                        : lesson.delivery;

                    return (
                      <tr key={lesson.lesson_id}>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                          {formatDateTimeLondon(lesson.start_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                          {deliveryLabel}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                          {lesson.duration_min} min
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                          {getSncLabel(lesson)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                          {lesson.state}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right font-medium text-gray-900">
                          {earningsCell}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right">
                          <Link
                            href={`/teacher/lessons/${lesson.lesson_id}`}
                            className="text-[11px] font-medium text-blue-600 hover:text-blue-800"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-[11px] text-gray-500">
          Note: Earnings are calculated in the database from your lesson
          duration and effective rate for this student (online vs face-to-face),
          and shown here in £ per lesson. All short-notice cancellations that
          are confirmed are treated as paid lessons for you.
        </p>
      </div>
    </Section>
  );
}
