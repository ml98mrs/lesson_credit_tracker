// lib/api/student/lessons.ts

import { getServerSupabase } from "@/lib/supabase/server";
import type { Delivery, SncMode } from "@/lib/enums";

// Convenience alias for the server Supabase client type
export type ServerSupabaseClient = Awaited<
  ReturnType<typeof getServerSupabase>
>;

// DB delivery enum is 'online' | 'f2f'; we keep "hybrid" as a local UI-only extension.
export type LessonDelivery = Delivery | "hybrid";

export type StudentLessonRow = {
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

export type StudentLessonsFilter = {
  from?: string;
  to?: string;
  teacher?: string;
  delivery?: Delivery;
  snc?: "snc" | "free" | "charged" | "none" | "";
  month?: string; // "1".."12"
  year?: string;  // "2024" etc.
  invoice?: string;
};

/**
 * Shared query helper for student lesson history.
 * Used by:
 *   - app/(student)/student/lessons/page.tsx
 *   - app/(student)/student/lessons/download/route.ts
 */
export async function fetchStudentLessons(
  supabase: ServerSupabaseClient,
  studentId: string,
  filters: StudentLessonsFilter,
): Promise<StudentLessonRow[]> {
  const {
    month,
    year,
    from,
    to,
    teacher,
    delivery,
    snc,
    invoice,
  } = filters;

  // Build date bounds (month/year takes precedence over from/to)
  let fromIso: string | undefined;
  let toIso: string | undefined;

  if (month && year) {
    const m = Number(month) - 1; // JS months 0–11
    const y = Number(year);

    if (!Number.isNaN(m) && !Number.isNaN(y)) {
      const start = new Date(Date.UTC(y, m, 1, 0, 0, 0));
      const end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0)); // exclusive
      fromIso = start.toISOString();
      toIso = end.toISOString();
    }
  } else {
    if (from) {
      const fromDate = new Date(from);
      fromIso = fromDate.toISOString();
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setDate(toDate.getDate() + 1); // inclusive end of "to" day
      toIso = toDate.toISOString();
    }
  }

  // Base query
  let query = supabase
    .from("v_student_lessons")
    .select(
      "lesson_id,occurred_at,duration_min,delivery,is_snc,snc_mode,state,teacher_full_name,allocation_summary",
    )
    .eq("student_id", studentId)
    .eq("state", "confirmed");

  // Date range using derived bounds
  if (fromIso) {
    query = query.gte("occurred_at", fromIso);
  }
  if (toIso) {
    query = query.lt("occurred_at", toIso);
  }

  if (teacher) {
    query = query.ilike("teacher_full_name", `%${teacher}%`);
  }

  if (delivery) {
    query = query.eq("delivery", delivery);
  }

  if (invoice) {
    // Uses allocation_summary, which typically includes invoice details
    query = query.ilike("allocation_summary", `%${invoice}%`);
  }

  if (snc === "snc") {
    query = query.eq("is_snc", true);
  } else if (snc === "free") {
    query = query.eq("snc_mode", "free");
  } else if (snc === "charged") {
    query = query.eq("snc_mode", "charged");
  } else if (snc === "none") {
    query = query.eq("is_snc", false);
  }
  // snc === "" or undefined → no extra filter

  query = query.order("occurred_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as StudentLessonRow[];
}
