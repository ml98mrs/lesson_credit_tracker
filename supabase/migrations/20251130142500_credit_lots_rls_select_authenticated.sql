-- RLS: credit_lots select -> authenticated-only

begin;

alter policy "credit_lots select"
on public.credit_lots
to authenticated
using (
  auth_is_admin()
  OR EXISTS (
    SELECT 1
    FROM students s
    WHERE s.id = credit_lots.student_id
      AND s.profile_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM student_teacher st
    JOIN teachers t ON t.id = st.teacher_id
    WHERE st.student_id = credit_lots.student_id
      AND t.profile_id = auth.uid()
  )
);

commit;
