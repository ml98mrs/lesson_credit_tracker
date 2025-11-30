-- Tighten lessons insert RLS so teachers can only
-- insert for students they are linked to in student_teacher.
-- We already have a stricter policy:
--   "lessons insert by teacher or admin"
-- which enforces teacher_id + student_teacher link.
-- So we drop the looser one.

drop policy if exists "teachers_can_insert_own_lessons"
on public.lessons;
