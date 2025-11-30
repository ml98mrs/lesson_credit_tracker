-- RLS: allow admins to see all teacher_rates, teachers see their own

begin;

alter policy "teacher_rates select own"
on public.teacher_rates
using (
  auth_is_admin()
  or teacher_id in (
    select t.id
    from teachers t
    where t.profile_id = auth.uid()
  )
);

commit;
