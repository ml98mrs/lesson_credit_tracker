// lib/types/views/student.ts
//
// Row types for student-related SQL views used across the app.
// These mirror DB view shapes; keep them in sync with Supabase.

import type { Delivery } from "@/lib/enums";

export type VStudentCreditSummaryRow = {
  student_id: string;
  total_granted_min: number | null;
  total_allocated_min: number | null;
  total_remaining_min: number | null;
  next_expiry_date: string | null;
};

export type VStudentCreditDeliverySummaryRow = {
  student_id: string;
  purchased_min: number | null;
  purchased_online_min: number | null;
  purchased_f2f_min: number | null;
  used_online_min: number | null;
  used_f2f_min: number | null;
  remaining_online_min: number | null;
  remaining_f2f_min: number | null;
};

export type VStudentAwardReasonSummaryRow = {
  award_reason_code: string;
  granted_award_min: number | null;
  used_award_min: number | null;
  remaining_award_min: number | null;
};

// Lifetime SNC history rows (from v_student_snc_lessons)
export type VStudentSncLessonRow = {
  is_charged: boolean | null;
};

export type VStudentDeliveryAlertRow = {
  student_id: string;
  delivery: Delivery;
  remaining_minutes: number;
  avg_month_hours: number | null;
  buffer_hours: number | null;
  is_generic_low: boolean;
  is_dynamic_low: boolean;
  is_low_any: boolean;
};

export type VStudentLastActivityRow = {
  student_id: string;
  last_activity_at: string | null;
};
