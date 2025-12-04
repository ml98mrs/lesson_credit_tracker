// lib/types/views/analytics.ts
//
// View-row types for analytics-related SQL views,
// e.g. v_lesson_margin_with_drinks_with_names.
//
// Keep these in sync with the Supabase view definitions.

export type LessonMarginRow = {
  lesson_id: string;
  teacher_id: string;
  student_id: string;
  teacher_name: string | null;
  student_name: string | null;
  month_start: string;
  start_at: string;
  duration_min: number;
  delivery: "online" | "f2f";
  revenue_pennies: number | null;
  teacher_earnings_pennies: number | null;
  margin_before_drinks_pennies: number | null;
  drinks_allocated_pennies: number | null;
  margin_after_drinks_pennies: number | null;
  margin_after_drinks_pct: number | null;
  student_tier: string | null;
  length_cat: string | null;
};
