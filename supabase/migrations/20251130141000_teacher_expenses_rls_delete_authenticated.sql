-- RLS: teacher_expenses delete pending own -> authenticated-only

begin;

alter policy "teacher_expenses_delete_pending_own"
on public.teacher_expenses
to authenticated
using (
  status = 'pending'
  and teacher_id in (
    select t.id
    from teachers t
    where t.profile_id = auth.uid()
  )
);

commit;
