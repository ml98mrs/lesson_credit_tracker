-- Stage 4: make v_teacher_lesson_earnings_detail run with invoker's RLS

begin;

alter view public.v_teacher_lesson_earnings_detail
set (security_invoker = true);

commit;
