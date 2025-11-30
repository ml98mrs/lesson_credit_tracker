-- RLS: teachers read own row or admin, authenticated only

begin;

alter policy "teachers read own or admin"
on public.teachers
to authenticated
using ((profile_id = auth.uid()) OR auth_is_admin());

commit;
