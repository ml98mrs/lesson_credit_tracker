-- RLS: lessons insert by teacher/admin -> authenticated-only

begin;

alter policy "lessons insert by teacher or admin"
on public.lessons
to authenticated
with check (
  auth_is_admin()
  OR (
    EXISTS (
      SELECT 1
      FROM teachers t
      WHERE t.id = lessons.teacher_id
        AND t.profile_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM student_teacher st
      WHERE st.student_id = lessons.student_id
        AND st.teacher_id = lessons.teacher_id
    )
  )
);

commit;
