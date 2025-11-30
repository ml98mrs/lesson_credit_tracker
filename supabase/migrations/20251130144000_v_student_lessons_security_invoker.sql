-- Stage 4: make v_student_lessons run with invoker's RLS, not definer

begin;

alter view public.v_student_lessons
set (security_invoker = true);

commit;
