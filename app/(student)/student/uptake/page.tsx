// app/(student)/student/uptake/page.tsx

import { getServerSupabase } from "@/lib/supabase/server";
import { formatMinutesAsHours } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type LessonRow = {
  occurred_at: string;
  duration_min: number;
};

type WeeklyBucket = {
  // Monday of that week (local-ish, but computed from UTC date)
  weekStart: Date;
  totalMinutes: number;
};

export default async function StudentUptakePage() {
  const sb = await getServerSupabase();

  // 1) Who is the logged-in student?
  const { data: u } = await sb.auth.getUser();
  const user = u?.user;
  if (!user) {
    return <p className="text-sm text-red-600">Please sign in.</p>;
  }

  // Pattern: students.profile_id = auth user id
  const { data: student, error: studentErr } = await sb
    .from("students")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (studentErr || !student?.id) {
    return (
      <p className="text-sm text-red-600">
        Couldn&apos;t find a student record for this login.
      </p>
    );
  }

  const studentId = student.id as string;

  // 2) Compute the 12-week window (inclusive of current week)
  const now = new Date();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  // Start from 11 weeks ago (so we have 12 buckets total, incl. current week)
  const startDate = new Date(now.getTime() - 11 * 7 * MS_PER_DAY);
  startDate.setUTCHours(0, 0, 0, 0);

  // 3) Load confirmed lessons for this student within that window
  const { data: lessonData, error: lessonErr } = await sb
    .from("lessons")
    .select("occurred_at, duration_min")
    .eq("state", "confirmed")
    .eq("student_id", studentId)
    .gte("occurred_at", startDate.toISOString())
    .order("occurred_at", { ascending: true });

  if (lessonErr) {
    return (
      <p className="text-sm text-red-600">
        Error loading lesson history: {lessonErr.message}
      </p>
    );
  }

  const lessons = (lessonData ?? []) as LessonRow[];

  // 4) Build weekly buckets in JS (presentation-layer aggregation)
  const buckets: WeeklyBucket[] = buildWeeklyBuckets(startDate, now, lessons);

  const totalMinutes = buckets.reduce((sum, b) => sum + b.totalMinutes, 0);
  const averageMinutes =
    buckets.length > 0 ? totalMinutes / buckets.length : 0;

  const maxMinutes = buckets.reduce(
    (max, b) => (b.totalMinutes > max ? b.totalMinutes : max),
    0,
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Lesson uptake</h1>
        <p className="mt-1 text-sm text-gray-600">
          A snapshot of how you&apos;ve been using your lessons over the last
          few months.
        </p>
      </header>

      {/* Summary cards */}
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-gray-500">Total lesson time</p>
          <p className="mt-1 text-lg font-semibold">
            {formatMinutesAsHours(totalMinutes)} hours
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Confirmed lessons over the last 12 weeks.
          </p>
        </div>

        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-gray-500">Average per week</p>
          <p className="mt-1 text-lg font-semibold">
            {formatMinutesAsHours(Math.round(averageMinutes))} hours
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Based on your weekly total lesson time.
          </p>
        </div>

        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-gray-500">Most active week</p>
          {maxMinutes > 0 ? (
            <>
              <p className="mt-1 text-lg font-semibold">
                {formatMinutesAsHours(maxMinutes)} hours
              </p>
              <p className="mt-1 text-xs text-gray-500">
                in the week of{" "}
                {formatWeekLabel(
                  buckets.find((b) => b.totalMinutes === maxMinutes)!.weekStart,
                )}
              </p>
            </>
          ) : (
            <p className="mt-1 text-lg font-semibold">No lessons yet</p>
          )}
        </div>
      </div>

      {/* Histogram */}
      <section className="space-y-3 rounded-lg border bg-white p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Weekly lesson time</h2>
          <p className="text-[11px] text-gray-500">
            Each bar shows the total confirmed lesson time per week.
          </p>
        </div>

        {buckets.length === 0 || maxMinutes === 0 ? (
          <p className="text-xs text-gray-500">
            Once you&apos;ve had a few confirmed lessons, you&apos;ll see your
            weekly lesson pattern here.
          </p>
        ) : (
          <Histogram buckets={buckets} maxMinutes={maxMinutes} />
        )}
      </section>
    </div>
  );
}

// ------------------------------
// Helpers: weekly buckets & formatting
// ------------------------------

function buildWeeklyBuckets(
  startDate: Date,
  endDate: Date,
  lessons: LessonRow[],
): WeeklyBucket[] {
  // We’ll treat "weeks" as 7-day blocks starting from startDate.
  // This keeps the logic simple and purely presentational.
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const MS_PER_WEEK = 7 * MS_PER_DAY;

  // Normalise lessons into Dates once
  const lessonDates = lessons.map((l) => ({
    date: new Date(l.occurred_at),
    duration_min: l.duration_min,
  }));

  const buckets: WeeklyBucket[] = [];

  let cursor = new Date(startDate.getTime());
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor <= endDate) {
    const bucketStart = new Date(cursor.getTime());
    const bucketEnd = new Date(cursor.getTime() + MS_PER_WEEK);

    const totalMinutes = lessonDates
      .filter(
        (l) => l.date >= bucketStart && l.date < bucketEnd,
      )
      .reduce((sum, l) => sum + (l.duration_min ?? 0), 0);

    buckets.push({ weekStart: bucketStart, totalMinutes });

    cursor = bucketEnd;
  }

  return buckets;
}

function formatWeekLabel(weekStart: Date): string {
  // dd.MM (e.g. 05.06)
  const d = weekStart;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
}

type HistogramProps = {
  buckets: WeeklyBucket[];
  maxMinutes: number;
};

function Histogram({ buckets, maxMinutes }: HistogramProps) {
  // Avoid division by zero
  const safeMax = maxMinutes || 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-1 sm:gap-2">
        {buckets.map((b, idx) => {
          const ratio = b.totalMinutes / safeMax;
          const height = 20 + ratio * 80; // min 20px, max 100px

          const hoursLabel =
            b.totalMinutes > 0
              ? formatMinutesAsHours(b.totalMinutes)
              : "0.00";

          return (
            <div
              key={idx}
              className="flex flex-1 flex-col items-center gap-1"
            >
              <div
                className="flex w-full items-end justify-center rounded-t bg-sky-200"
                style={{ height: `${height}px` }}
                aria-hidden="true"
              >
                {b.totalMinutes > 0 && (
                  <span className="mb-1 text-[10px] font-medium text-sky-900">
                    {hoursLabel}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-gray-500">
                {formatWeekLabel(b.weekStart)}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-500">
        Bars cover roughly the last 12 weeks. Values shown in hours (confirmed
        lessons only).
      </p>
    </div>
  );
}
