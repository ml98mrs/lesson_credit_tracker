// app/(student)/student/lessons/page.tsx

import Section from "@/components/ui/Section";
import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import { formatStudentDateTime } from "@/lib/formatters";
import { formatDeliveryLabel } from "@/lib/domain/lessons";
import type { Delivery } from "@/lib/enums";
import type { ProfileRow } from "@/lib/types/profiles";
import StudentLessonQueryButton from "@/components/student/StudentLessonQueryButton";
import {
  fetchStudentLessons,
  type StudentLessonsFilter,
  type StudentLessonRow as LessonRow,
} from "@/lib/api/student/lessons";

export const dynamic = "force-dynamic";

type SearchParams = {
  from?: string;
  to?: string;
  teacher?: string;
  delivery?: string;
  snc?: string;
  month?: string;
  year?: string;
  invoice?: string;
};

const formatLessonDelivery = (d: LessonRow["delivery"]) => {
  if (d === "hybrid") return "Hybrid";
  // At runtime non-hybrid values are the DB enum ('online' | 'f2f')
  return formatDeliveryLabel(d as Delivery);
};


const renderSncBadge = (lesson: LessonRow) => {
  if (!lesson.is_snc) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  if (lesson.snc_mode === "free") {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        Free SNC (no credit used)
      </span>
    );
  }

  if (lesson.snc_mode === "charged") {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        Charged SNC (minutes deducted)
      </span>
    );
  }

  // Fallback for any historical/edge cases
  return (
    <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
      SNC
    </span>
  );
};

export default async function StudentLessons({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // 🔹 resolve search params (Next 16 passes a Promise)
  const sp = await searchParams;

  const supabase = await getServerSupabase();

  // 1) Logged-in user
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    throw new Error("No authenticated student found.");
  }

  // 2) Student linked to this profile
  const { data: studentRow, error: sErr } = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (sErr) throw new Error(sErr.message);

  if (!studentRow) {
    return (
      <Section title="Lessons" subtitle="Confirmed lessons for your account.">
        <p className="text-sm text-gray-600">
          No student record is linked to this account yet. Please contact the
          administrator.
        </p>
      </Section>
    );
  }

  const studentId = studentRow.id as string;

  // 3) Profile timezone (student's local time zone)
  const { data: profileRow, error: profileErr } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single<Pick<ProfileRow, "timezone">>();

  if (profileErr) {
    throw new Error(profileErr.message);
  }

  const studentTimeZone = profileRow?.timezone ?? "Europe/London";

  // 4) Normalise filters from searchParams
  const monthParam = sp.month || undefined; // "1".."12"
  const yearParam = sp.year || undefined; // "2024" etc.

  const dateFrom = sp.from || undefined;
  const dateTo = sp.to || undefined;
  const teacherFilter = sp.teacher || undefined;
  const deliveryFilter = sp.delivery as Delivery | undefined;
  const rawSnc = sp.snc;
  const invoiceFilter = sp.invoice || undefined;

  // Narrow SNC filter to the allowed union
  const sncFilter: StudentLessonsFilter["snc"] =
    rawSnc === "snc" ||
    rawSnc === "free" ||
    rawSnc === "charged" ||
    rawSnc === "none" ||
    rawSnc === ""
      ? (rawSnc as StudentLessonsFilter["snc"])
      : undefined;

  // Build query string for download link (reuse current filters)
  const qs = new URLSearchParams();
  if (monthParam) qs.set("month", monthParam);
  if (yearParam) qs.set("year", yearParam);
  if (dateFrom) qs.set("from", dateFrom);
  if (dateTo) qs.set("to", dateTo);
  if (teacherFilter) qs.set("teacher", teacherFilter);
  if (deliveryFilter) qs.set("delivery", deliveryFilter);
  if (sncFilter) qs.set("snc", sncFilter);
  if (invoiceFilter) qs.set("invoice", invoiceFilter);

  const downloadHref =
    qs.toString().length > 0
      ? `/student/lessons/download?${qs.toString()}`
      : "/student/lessons/download";

  // 5) Shared lessons fetch (via lib/api/student/lessons)
  const filterObj: StudentLessonsFilter = {
    month: monthParam,
    year: yearParam,
    from: dateFrom,
    to: dateTo,
    teacher: teacherFilter,
    delivery: deliveryFilter,
    snc: sncFilter,
    invoice: invoiceFilter,
  };

  const lessons = await fetchStudentLessons(supabase, studentId, filterObj);

  const lessonCount = lessons.length;
  const hasFilters = !!(
    monthParam ||
    yearParam ||
    dateFrom ||
    dateTo ||
    teacherFilter ||
    deliveryFilter ||
    sncFilter ||
    invoiceFilter
  );

  return (
    <Section
      title="Lessons"
      subtitle="Confirmed lessons for your account. It is likely to exclude lessons taken this month."
    >
      {/* Filters */}
      <form
        className="mb-4 grid gap-3 text-xs md:grid-cols-4 lg:grid-cols-6"
        method="GET"
      >
        {/* Month */}
        <div className="flex flex-col gap-1">
          <label htmlFor="month" className="text-gray-600">
            Month
          </label>
          <select
            id="month"
            name="month"
            defaultValue={monthParam ?? ""}
            className="rounded border px-2 py-1"
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

        {/* Year */}
        <div className="flex flex-col gap-1">
          <label htmlFor="year" className="text-gray-600">
            Year
          </label>
          <input
            id="year"
            name="year"
            type="number"
            min="2000"
            max="2100"
            defaultValue={yearParam ?? ""}
            className="rounded border px-2 py-1"
            placeholder="YYYY"
          />
        </div>

        {/* Date from */}
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-gray-600">
            From (date)
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={dateFrom}
            className="rounded border px-2 py-1"
          />
        </div>

        {/* Date to */}
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-gray-600">
            To (date)
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={dateTo}
            className="rounded border px-2 py-1"
          />
        </div>

        {/* Teacher */}
        <div className="flex flex-col gap-1">
          <label htmlFor="teacher" className="text-gray-600">
            Teacher
          </label>
          <input
            id="teacher"
            name="teacher"
            type="text"
            placeholder="Name contains…"
            defaultValue={teacherFilter}
            className="rounded border px-2 py-1"
          />
        </div>

        {/* Delivery */}
        <div className="flex flex-col gap-1">
          <label htmlFor="delivery" className="text-gray-600">
            Delivery
          </label>
          <select
            id="delivery"
            name="delivery"
            defaultValue={deliveryFilter ?? ""}
            className="rounded border px-2 py-1"
          >
            <option value="">Any</option>
            <option value="online">Online</option>
            <option value="f2f">Face to face</option>
          </select>
        </div>

        {/* SNC filter */}
        <div className="flex flex-col gap-1">
          <label htmlFor="snc" className="text-gray-600">
            SNC
          </label>
          <select
            id="snc"
            name="snc"
            defaultValue={sncFilter ?? ""}
            className="rounded border px-2 py-1"
          >
            <option value="">Any</option>
            <option value="snc">SNC only</option>
            <option value="free">Free SNC only</option>
            <option value="charged">Charged SNC only</option>
            <option value="none">Non-SNC lessons</option>
          </select>
        </div>

        {/* Invoice filter */}
        <div className="flex flex-col gap-1">
          <label htmlFor="invoice" className="text-gray-600">
            Invoice #
          </label>
          <input
            id="invoice"
            name="invoice"
            type="text"
            placeholder="Matches invoice text…"
            defaultValue={invoiceFilter}
            className="rounded border px-2 py-1"
          />
        </div>

        {/* Actions + count */}
        <div className="flex items-end gap-2 md:col-span-2 lg:col-span-2">
          <button
            type="submit"
            className="rounded border bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-800"
          >
            Apply filters
          </button>
          <Link
            href="/student/lessons"
            className="rounded border px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            Clear
          </Link>
          <Link
            href={downloadHref}
            className="rounded border px-3 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
          >
            Download Excel
          </Link>
          <span className="ml-auto text-[11px] text-gray-500">
            Showing <span className="font-semibold">{lessonCount}</span>{" "}
            lesson{lessonCount === 1 ? "" : "s"}
            {hasFilters ? " (filtered)" : ""}
          </span>
        </div>
      </form>

      <p className="mb-2 text-[10px] text-gray-500">
        If both month/year and a date range are set, the month/year filter takes
        precedence.
      </p>

      {/* Results */}
      {lessons.length === 0 ? (
        <p className="text-sm text-gray-600">
          No lessons match your current filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Teacher</th>
                <th className="py-2 pr-4">Delivery</th>
                <th className="py-2 pr-4">Duration (min)</th>
                <th className="py-2 pr-4">Credit</th>
                <th className="py-2 pr-4">SNC</th>
                <th className="py-2 pr-4 text-right">Query</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((lesson) => {
                const lessonSummary = `${formatStudentDateTime(
                  lesson.occurred_at,
                  studentTimeZone,
                )} – ${lesson.duration_min} min – ${
                  lesson.teacher_full_name
                }`;

                return (
                  <tr key={lesson.lesson_id} className="border-b">
                    <td className="py-2 pr-4">
                      {formatStudentDateTime(
                        lesson.occurred_at,
                        studentTimeZone,
                      )}
                    </td>
                    <td className="py-2 pr-4">{lesson.teacher_full_name}</td>
                    <td className="py-2 pr-4">
                      {formatLessonDelivery(lesson.delivery)}
                    </td>
                    <td className="py-2 pr-4">{lesson.duration_min}</td>
                    <td className="py-2 pr-4">
                      {lesson.allocation_summary
                        ? lesson.allocation_summary
                        : lesson.is_snc && lesson.snc_mode === "free"
                        ? "Free SNC (no credit used)"
                        : "—"}
                    </td>
                    <td className="py-2 pr-4">
                      {renderSncBadge(lesson)}
                    </td>
                    <td className="py-2 pl-4 text-right">
                      <StudentLessonQueryButton
                        lessonId={lesson.lesson_id}
                        summary={lessonSummary}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
