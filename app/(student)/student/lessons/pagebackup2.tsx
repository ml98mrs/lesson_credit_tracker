// app/(student)/student/lessons/page.tsx

import Section from "@/components/ui/Section";
import { getServerSupabase } from "@/lib/supabase/server";
import type { Delivery, SncMode } from "@/lib/enums";

export const dynamic = "force-dynamic";

// DB delivery enum is 'online' | 'f2f'; we keep "hybrid" as a local UI-only extension.
type LessonDelivery = Delivery | "hybrid";

type LessonRow = {
  lesson_id: string;
  occurred_at: string;
  duration_min: number;
  delivery: LessonDelivery;
  is_snc: boolean;
  snc_mode: SncMode | string;
  state: string;
  teacher_full_name: string;
  allocation_summary: string | null;
};

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

export default async function StudentLessons({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Still resolve searchParams to keep the signature compatible with Next 16,
  // but we don't use them in this TEMP debug version.
  await searchParams;

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
      <Section title="Lessons (DEBUG)" subtitle="Student record lookup failed.">
        <p className="text-sm text-gray-600">
          No student record is linked to this account yet. Please contact the
          administrator.
        </p>
      </Section>
    );
  }

  const studentId = studentRow.id as string;

  // 3) 🔍 TEMP DEBUG: bypass view and query lessons table directly
  const { data, error } = await supabase
    .from("lessons")
    .select("id, student_id, state, occurred_at")
    .eq("student_id", studentId)
    .order("occurred_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <Section
      title="Lessons (DEBUG)"
      subtitle="Raw lessons rows as seen through RLS for this student (directly from lessons table)."
    >
      <pre className="text-xs whitespace-pre-wrap break-all rounded bg-gray-50 p-3">
        {JSON.stringify(
          {
            userId: user.id,
            studentId,
            lessonsFromLessonsTable: data,
          },
          null,
          2,
        )}
      </pre>
      <p className="mt-2 text-[11px] text-gray-500">
        This is temporary debug output from the <code>lessons</code> table
        (bypassing <code>v_student_lessons</code>). Once this looks correct,
        we’ll switch the query back to the view and restore the filters/table UI.
      </p>
    </Section>
  );
}
