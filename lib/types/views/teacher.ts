// lib/types/views/teacher.ts
//
// Row types for teacher-related SQL views used across the app.
// Keep this in sync with the v_teacher_lessons view definition.

export type VTeacherLessonRow = {
  id: string;
  student_id: string;
  start_at: string;      // UTC ISO string
  duration_min: number;
  state: string;
  student_name: string | null;
  // Add any extra columns from the view here as needed
};
