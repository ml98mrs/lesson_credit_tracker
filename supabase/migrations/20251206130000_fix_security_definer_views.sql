-- 20251206130000_fix_security_definer_views.sql
-- Fix security_definer_view lint errors by forcing all analytic views
-- to run with the caller's RLS (security_invoker = on).

begin;

alter view public.v_allocation_delivery_hazards
  set (security_invoker = on);

alter view public.v_allocation_delivery_hazards_raw
  set (security_invoker = on);

alter view public.v_allocation_length_restriction_hazards
  set (security_invoker = on);

alter view public.v_allocation_length_restriction_hazards_raw
  set (security_invoker = on);

alter view public.v_credit_expiry_by_month
  set (security_invoker = on);

alter view public.v_credit_lot_remaining
  set (security_invoker = on);

alter view public.v_lesson_hazards
  set (security_invoker = on);

alter view public.v_lesson_length_hazards
  set (security_invoker = on);

alter view public.v_lesson_length_hazards_raw
  set (security_invoker = on);

alter view public.v_lesson_margin_detail
  set (security_invoker = on);

alter view public.v_lesson_margin_with_drinks_detail
  set (security_invoker = on);

alter view public.v_lesson_margin_with_drinks_with_names
  set (security_invoker = on);

alter view public.v_lesson_revenue_detail
  set (security_invoker = on);

alter view public.v_lot_allocations_detail
  set (security_invoker = on);

alter view public.v_overdraft_allocation_hazards
  set (security_invoker = on);

alter view public.v_past_students_cleanup_candidates
  set (security_invoker = on);

alter view public.v_snc_overuse_hazards
  set (security_invoker = on);

alter view public.v_snc_overuse_hazards_raw
  set (security_invoker = on);

alter view public.v_snc_stats_by_month
  set (security_invoker = on);

alter view public.v_snc_stats_by_month_with_names
  set (security_invoker = on);

alter view public.v_student_award_reason_summary
  set (security_invoker = on);

alter view public.v_student_cohort_base
  set (security_invoker = on);

alter view public.v_student_cohort_summary
  set (security_invoker = on);

alter view public.v_student_credit_delivery_summary
  set (security_invoker = on);

alter view public.v_student_credit_summary
  set (security_invoker = on);

alter view public.v_student_dynamic_credit_alerts
  set (security_invoker = on);

alter view public.v_student_dynamic_credit_alerts_by_delivery
  set (security_invoker = on);

alter view public.v_student_last_activity
  set (security_invoker = on);

alter view public.v_student_lessons
  set (security_invoker = on);

alter view public.v_student_lifecycle_summary
  set (security_invoker = on);

alter view public.v_student_names
  set (security_invoker = on);

alter view public.v_student_snc_lessons
  set (security_invoker = on);

alter view public.v_student_snc_status_by_month
  set (security_invoker = on);

alter view public.v_student_snc_status_previous_month
  set (security_invoker = on);

alter view public.v_student_teacher_rate_summary
  set (security_invoker = on);

alter view public.v_student_usage_last_3m
  set (security_invoker = on);

alter view public.v_teacher_drinks_expenses_by_student_month
  set (security_invoker = on);

alter view public.v_teacher_expenses_detail_by_month
  set (security_invoker = on);

alter view public.v_teacher_expenses_summary
  set (security_invoker = on);

alter view public.v_teacher_invoice_summary
  set (security_invoker = on);

alter view public.v_teacher_last_activity
  set (security_invoker = on);

alter view public.v_teacher_lesson_earnings_by_month
  set (security_invoker = on);

alter view public.v_teacher_lesson_earnings_by_student_month
  set (security_invoker = on);

alter view public.v_teacher_lesson_earnings_detail
  set (security_invoker = on);

alter view public.v_teacher_lesson_earnings_last_month
  set (security_invoker = on);

alter view public.v_teacher_lesson_margin_by_student_month
  set (security_invoker = on);

alter view public.v_teacher_lesson_revenue_by_month
  set (security_invoker = on);

alter view public.v_teacher_lesson_stats_by_month
  set (security_invoker = on);

alter view public.v_teacher_lessons
  set (security_invoker = on);

alter view public.v_teacher_margin_by_month
  set (security_invoker = on);

alter view public.v_teacher_margin_by_month_with_names
  set (security_invoker = on);

alter view public.v_teacher_names
  set (security_invoker = on);

alter view public.v_teacher_rate_summary
  set (security_invoker = on);

alter view public.v_teacher_usage_last_3m
  set (security_invoker = on);

commit;
