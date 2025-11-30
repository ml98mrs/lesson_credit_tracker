-- RLS: allocations select -> authenticated-only

begin;

alter policy "allocations select"
on public.allocations
to authenticated
using (
  auth_is_admin()
  OR EXISTS (
    SELECT 1
    FROM lessons l
    JOIN teachers t ON t.id = l.teacher_id
    WHERE l.id = allocations.lesson_id
      AND t.profile_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM lessons l
    JOIN students s ON s.id = l.student_id
    WHERE l.id = allocations.lesson_id
      AND s.profile_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM credit_lots cl
    JOIN students s ON s.id = cl.student_id
    WHERE cl.id = allocations.credit_lot_id
      AND s.profile_id = auth.uid()
  )
);

commit;
