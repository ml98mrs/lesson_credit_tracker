-- RLS: students admin write -> authenticated-only admin

begin;

alter policy "students admin write"
on public.students
to authenticated
using (auth_is_admin())
with check (auth_is_admin());

commit;
