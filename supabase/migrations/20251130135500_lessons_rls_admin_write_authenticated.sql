-- RLS: lessons admin write -> authenticated-only admin

begin;

alter policy "lessons admin write"
on public.lessons
to authenticated
using (auth_is_admin())
with check (auth_is_admin());

commit;
