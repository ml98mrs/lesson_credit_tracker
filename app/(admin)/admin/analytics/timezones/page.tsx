// app/(admin)/admin/analytics/timezones/page.tsx

import Link from "next/link";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { ProfileRow } from "@/lib/types/profiles";

export const dynamic = "force-dynamic";

type SearchParams = {
  status?: string; // "current" | "dormant" | "past" | "all"
};

type StudentWithProfileTimezone = {
  status: string;
  profiles: Pick<ProfileRow, "timezone"> | null;
};

type LessonWithStudentProfile = {
  occurred_at: string;
  students: {
    status: string;
    profiles: Pick<ProfileRow, "timezone"> | null;
  } | null;
};

const STATUS_OPTIONS = ["current", "dormant", "past", "all"] as const;
type StatusOption = (typeof STATUS_OPTIONS)[number];

const LOOKBACK_DAYS = 90;

function normaliseStatusFilter(raw?: string): StatusOption {
  if (!raw) return "current";
  const lower = raw.toLowerCase();

  return STATUS_OPTIONS.includes(lower as StatusOption)
    ? (lower as StatusOption)
    : "current";
}


function getLocalHour(dateIso: string, timeZone: string): number {
  const d = new Date(dateIso);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
  const hour = Number(hourStr);
  return Number.isNaN(hour) ? 0 : hour;
}

export default async function TimezoneAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const statusFilter = normaliseStatusFilter(sp.status);

  const supabase = await getAdminSupabase();

  // ─────────────────────────────────────────────────────────────
  // 1) Student counts by timezone
  // ─────────────────────────────────────────────────────────────

  let studentQuery = supabase
    .from("students")
    .select(
      `
        status,
        profiles (
          timezone
        )
      `,
    )
    .order("status", { ascending: true });

  if (statusFilter !== "all") {
    studentQuery = studentQuery.eq("status", statusFilter);
  }

  const { data: studentData, error: studentError } = await studentQuery;

  if (studentError) {
    throw new Error(studentError.message);
  }

  const students = (studentData ?? []) as unknown as StudentWithProfileTimezone[];

  const timezoneCounts = new Map<string, number>();
  for (const row of students) {
    const tz = row.profiles?.timezone ?? "Europe/London";
    timezoneCounts.set(tz, (timezoneCounts.get(tz) ?? 0) + 1);
  }

  const totalStudents = students.length;

  const timezoneList = Array.from(timezoneCounts.entries())
    .map(([timezone, count]) => ({ timezone, count }))
    .sort((a, b) => b.count - a.count || a.timezone.localeCompare(b.timezone));

  // ─────────────────────────────────────────────────────────────
  // 2) Lesson counts by student local hour (last 90 days)
  // ─────────────────────────────────────────────────────────────

  const lookbackStart = new Date();
  lookbackStart.setDate(lookbackStart.getDate() - LOOKBACK_DAYS);
  const fromIso = lookbackStart.toISOString();

  // Confirmed lessons only, last N days; join to students + profiles for timezone
  const { data: lessonData, error: lessonError } = await supabase
    .from("lessons")
    .select(
      `
        occurred_at,
        students (
          status,
          profiles (
            timezone
          )
        )
      `,
    )
    .eq("state", "confirmed")
    .gte("occurred_at", fromIso);

  if (lessonError) {
    throw new Error(lessonError.message);
  }

  let lessons = (lessonData ?? []) as unknown as LessonWithStudentProfile[];

  // Filter by student status in JS if needed
  if (statusFilter !== "all") {
    lessons = lessons.filter(
      (l) => l.students?.status === statusFilter,
    );
  }

  const hourCounts = new Array<number>(24).fill(0);
  let totalLessons = 0;

  for (const lesson of lessons) {
    const tz = lesson.students?.profiles?.timezone ?? "Europe/London";
    const hour = getLocalHour(lesson.occurred_at, tz);
    if (hour >= 0 && hour < 24) {
      hourCounts[hour] += 1;
      totalLessons += 1;
    }
  }

  return (
    <main className="space-y-6">
      {/* SECTION 1: Student counts by timezone */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">
              Student timezones
            </h1>
            <p className="mt-1 text-xs text-gray-600">
              Raw counts of students by timezone, based on{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-[10px]">
                profiles.timezone
              </code>
              . Null values are treated as{" "}
              <span className="font-medium">Europe/London</span>.
            </p>
          </div>

          {/* Status toggle */}
          <div className="inline-flex items-center gap-1 rounded-full border bg-gray-50 px-1 py-1 text-[11px] text-gray-700">
            {STATUS_OPTIONS.map((option) => {
              const isActive = option === statusFilter;
              const label =
                option === "all"
                  ? "All"
                  : option.charAt(0).toUpperCase() + option.slice(1);
              const href =
                option === "current"
                  ? "/admin/analytics/timezones"
                  : `/admin/analytics/timezones?status=${option}`;

              return (
                <Link
                  key={option}
                  href={href}
                  className={[
                    "rounded-full px-2 py-1",
                    isActive
                      ? "bg-gray-900 text-white"
                      : "text-gray-700 hover:bg-white",
                  ].join(" ")}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mb-2 text-[11px] text-gray-500">
          Showing{" "}
          <span className="font-semibold">
            {totalStudents.toLocaleString("en-GB")}
          </span>{" "}
          student
          {totalStudents === 1 ? "" : "s"} with status{" "}
          <span className="font-semibold">
            {statusFilter === "all"
              ? "current / dormant / past"
              : statusFilter}
          </span>
          .
        </div>

        {timezoneList.length === 0 ? (
          <p className="text-sm text-gray-600">
            No students match the current filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500">
                  <th className="py-2 pr-4">Timezone</th>
                  <th className="py-2 pr-4 text-right">Student count</th>
                </tr>
              </thead>
              <tbody>
                {timezoneList.map((row) => (
                  <tr key={row.timezone} className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs text-gray-800">
                      {row.timezone}
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-900">
                      {row.count.toLocaleString("en-GB")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SECTION 2: Lesson counts by student local hour */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Lessons by student local hour
            </h2>
            <p className="mt-1 text-xs text-gray-600">
              Confirmed lessons in the last{" "}
              <span className="font-semibold">{LOOKBACK_DAYS}</span> days,
              grouped by the hour of day in the student local timezone.
            </p>
          </div>
        </div>

        <div className="mb-2 text-[11px] text-gray-500">
          Total{" "}
          <span className="font-semibold">
            {totalLessons.toLocaleString("en-GB")}
          </span>{" "}
          confirmed lesson
          {totalLessons === 1 ? "" : "s"} considered (status{" "}
          <span className="font-semibold">
            {statusFilter === "all"
              ? "current / dormant / past"
              : statusFilter}
          </span>
          ).
        </div>

        {totalLessons === 0 ? (
          <p className="text-sm text-gray-600">
            No lessons found in the selected window.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500">
                  <th className="py-2 pr-4">Local hour</th>
                  <th className="py-2 pr-4 text-right">Lesson count</th>
                </tr>
              </thead>
              <tbody>
                {hourCounts.map((count, hour) => (
                  <tr key={hour} className="border-b">
                    <td className="py-2 pr-4 text-xs text-gray-800">
                      {hour.toString().padStart(2, "0")}:00&nbsp;–{" "}
                      {hour.toString().padStart(2, "0")}:59
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-900">
                      {count.toLocaleString("en-GB")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
