// lib/api/admin/lessons.ts
//
// Shared admin helpers for lessons & hazards.
// IMPORTANT: all admin data access uses getAdminSupabase (service-role).


import { getAdminClient, type AdminClient, logAdminError } from "./_shared";

/**
 * Base query for "pending lessons".
 * Single source of truth for what counts as "pending".
 */
export function pendingLessonsBaseQuery(sb: AdminClient) {
  return sb
    .from("lessons")
    .select(
      "id, student_id, teacher_id, occurred_at, duration_min, delivery, length_cat, state, notes, is_snc",
    )
    .eq("state", "pending");
}

/**
 * Convenience helper for the dashboard pending count.
 * Uses the same 'state = pending' condition as the queue.
 */
export async function getPendingLessonsCount(): Promise<number> {
  const supabase = getAdminClient();

  const { count, error } = await supabase
    .from("lessons")
    .select("*", { count: "exact", head: true })
    .eq("state", "pending");

  if (error) {
    logAdminError("Error fetching pending lessons count", error);
    return 0;
  }

  return count ?? 0;
}

/**
 * Base query for unresolved hazards, via v_lesson_hazards.
 * Single source of truth for the hazards list page.
 */
export function lessonHazardsBaseQuery(sb: AdminClient) {
  return sb
    .from("v_lesson_hazards")
    .select("lesson_id, allocation_id, hazard_type, severity");
}

/**
 * Active hazards count for the dashboard card, based on v_lesson_hazards.
 * One row = one unresolved hazard instance.
 */
export async function getLessonHazardsCount(): Promise<number> {
  const supabase = getAdminClient();

  const { count, error } = await supabase
    .from("v_lesson_hazards")
    .select("*", { count: "exact", head: true });

  if (error) {
    logAdminError("Error fetching lesson hazards count", error);
    return 0;
  }

  return count ?? 0;
}