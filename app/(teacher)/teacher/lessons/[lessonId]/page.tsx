// app/(teacher)/teacher/lessons/[lessonId]/page.tsx

import Link from "next/link";
import Section from "@/components/ui/Section";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  formatDateLondon,
  formatTimeLondon,
  formatMinutesAsHours,
} from "@/lib/formatters";

type LessonDetailRow = {
  id: string;
  start_at: string;
  duration_min: number;
  student_id: string;
  state: string;
  student_name: string | null;
};

export const dynamic = "force-dynamic";

export default async function TeacherLessonDetailPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;

  if (!lessonId) {
    return (
      <Section title="Lesson detail">
        <p className="text-sm text-red-600">
          No lesson ID was provided in the URL.
        </p>
        <div className="mt-3 flex gap-2 text-xs">
          <Link
            href="/teacher/lessons/new"
            className="rounded border bg-gray-900 px-3 py-1 text-white hover:bg-gray-800"
          >
            Log a new lesson
          </Link>
          <Link
            href="/teacher/dashboard"
            className="rounded border px-3 py-1 text-gray-700 hover:bg-gray-50"
          >
            Back to teacher dashboard
          </Link>
        </div>
      </Section>
    );
  }

  const sb = await getServerSupabase();
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (userErr || !user) {
    return (
      <Section title="Lesson detail">
        <p className="text-sm text-gray-700">
          Please sign in to view lesson details.
        </p>
      </Section>
    );
  }

  // Look up the lesson by id only; RLS/view should already control visibility.
  const { data, error } = await sb
    .from("v_teacher_lessons")
    .select("id,start_at,duration_min,student_id,state,student_name")
    .eq("id", lessonId)
    .maybeSingle();

  if (error) {
    return (
      <Section title="Lesson detail">
        <p className="text-sm text-red-600">
          Failed to load lesson: {error.message}
        </p>
      </Section>
    );
  }

  if (!data) {
    return (
      <Section title="Lesson detail">
        <p className="mb-3 text-sm text-gray-700">
          No lesson was found with this ID, or you do not have permission to
          view it.
        </p>
        <div className="flex gap-2 text-xs">
          <Link
            href="/teacher/lessons/new"
            className="rounded border bg-gray-900 px-3 py-1 text-white hover:bg-gray-800"
          >
            Log a new lesson
          </Link>
          <Link
            href="/teacher/dashboard"
            className="rounded border px-3 py-1 text-gray-700 hover:bg-gray-50"
          >
            Back to teacher dashboard
          </Link>
        </div>
      </Section>
    );
  }

  const lesson: LessonDetailRow = {
    id: data.id,
    start_at: data.start_at,
    duration_min: data.duration_min,
    student_id: data.student_id,
    state: data.state,
    student_name: data.student_name,
  };

  const studentLabel =
    lesson.student_name ?? `${lesson.student_id.slice(0, 8)}…`;
  const dateLabel = formatDateLondon(lesson.start_at);
  const timeLabel = formatTimeLondon(lesson.start_at);
  const hoursLabel = formatMinutesAsHours(lesson.duration_min);

  return (
    <Section
      title="Lesson detail"
      subtitle="A read-only summary of this confirmed or pending lesson."
    >
      {/* Sub-nav */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
        <Link
          href="/teacher/lessons/new"
          className="inline-flex items-center rounded-full border px-2 py-0.5 hover:bg-gray-50"
        >
          <span className="mr-1 text-[10px]">←</span>
          Log a new lesson
        </Link>
        <span className="hidden text-gray-400 md:inline">·</span>
        <Link
          href="/teacher/dashboard"
          className="inline-flex items-center rounded-full border border-dashed px-2 py-0.5 hover:bg-gray-50"
        >
          Back to teacher dashboard
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Core facts */}
        <div className="rounded-2xl border bg-white p-4 text-sm shadow-sm">
          <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">
            Overview
          </div>
          <dl className="space-y-2 text-sm text-gray-800">
            <div>
              <dt className="text-xs font-medium text-gray-500">Student</dt>
              <dd className="text-sm font-semibold text-gray-900">
                {studentLabel}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">
                Date &amp; time (London)
              </dt>
              <dd className="text-sm text-gray-900">
                {dateLabel} · {timeLabel}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">
                Duration (hours)
              </dt>
              <dd className="text-sm text-gray-900">{hoursLabel} h</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">State</dt>
              <dd className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                {lesson.state}
              </dd>
            </div>
          </dl>
        </div>

        {/* Future hooks: minutes, allocations, hazards */}
        <div className="rounded-2xl border bg-white p-4 text-xs text-gray-700 shadow-sm">
          <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">
            Credit &amp; allocations
          </div>
          <p className="text-xs text-gray-600">
            This view is currently a simple summary of the lesson record. 
          </p>
          
        </div>
      </div>
    </Section>
  );
}
