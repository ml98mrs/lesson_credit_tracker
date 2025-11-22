// app/(teacher)/teacher/students/[studentId]/page.tsx

import Link from "next/link";
import Section from "@/components/ui/Section";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  formatDateTimeLondon,
  formatMinutesAsHours,
  formatPenniesAsPounds,
} from "@/lib/formatters";

export const dynamic = "force-dynamic";

type StudentNameRow = {
  student_name: string | null;
};

type LessonEarningRow = {
  lesson_id: string;
  start_at: string;
  duration_min: number;
  state: string;
  is_snc: boolean;
  snc_mode: "none" | "free" | "charged" | null;
  gross_pennies: number | null;
};

export default async function TeacherStudentDetail(props: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await props.params; // <-- fix for params Promise
  const supabase = await getServerSupabase();

  const [
    { data: studentNameRow, error: studentNameError },
    { data: lessonRows, error: lessonsError },
  ] = await Promise.all([
    // Get a display name from v_teacher_lessons (teacher-safe, known columns)
    supabase
      .from("v_teacher_lessons")
      .select("student_name")
      .eq("student_id", studentId)
      .order("start_at", { ascending: false })
      .limit(1)
      .maybeSingle<StudentNameRow>(),
    // Per-lesson earnings from v_teacher_lesson_earnings_detail
    supabase
      .from("v_teacher_lesson_earnings_detail")
      .select(
        "lesson_id, start_at, duration_min, state, is_snc, snc_mode, gross_pennies",
      )
      .eq("student_id", studentId)
      .order("start_at", { ascending: false })
      .limit(20)
      .returns<LessonEarningRow[]>(),
  ]);

  const studentName = studentNameRow?.student_name || "Student";

  return (
    <Section
      title={`Student: ${studentName}`}
      subtitle="Summary and recent lessons with this student."
    >
      <div className="space-y-6">
        {/* Top meta / quick actions */}
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
                You&apos;re viewing lessons and earnings for{" "}
                <span className="font-semibold">{studentName}</span>.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <Link
              href={`/teacher/lessons/new?studentId=${studentId}`}
              className="rounded-full border border-blue-600 px-3 py-1 font-medium text-blue-600 hover:bg-blue-50"
            >
              Log new lesson with {studentName}
            </Link>
            <Link
              href={`/teacher/lessons?studentId=${studentId}`}
              className="rounded-full border px-3 py-1 text-gray-700 hover:bg-gray-50"
            >
              See all lessons
            </Link>
          </div>
        </div>

        {/* Recent lessons + earnings */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Recent lessons &amp; earnings
            </h2>
            <p className="mt-1 text-xs text-gray-600">
              Up to 20 most recent confirmed lessons you&apos;ve logged with
              this student. Earnings are calculated in the database from your
              current rates.
            </p>
          </div>

          {lessonsError && (
            <div className="px-4 py-3 text-xs text-red-600">
              Couldn&apos;t load lesson history. Please try again later.
            </div>
          )}

          {!lessonsError && (!lessonRows || lessonRows.length === 0) && (
            <div className="px-4 py-3 text-sm text-gray-500">
              No confirmed lessons recorded yet with this student.
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
                      Length
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
                    const lengthHours = formatMinutesAsHours(
                      lesson.duration_min,
                    );

                    let sncLabel = "No";
                    if (lesson.is_snc) {
                      if (lesson.snc_mode === "free") sncLabel = "SNC (free)";
                      else if (lesson.snc_mode === "charged")
                        sncLabel = "SNC (charged)";
                      else sncLabel = "SNC";
                    }

                    const earningsCell =
                      lesson.gross_pennies == null
                        ? "—"
                        : formatPenniesAsPounds(lesson.gross_pennies);

                    return (
                      <tr key={lesson.lesson_id}>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                          {formatDateTimeLondon(lesson.start_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                          {lengthHours} h
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-900">
                          {sncLabel}
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
