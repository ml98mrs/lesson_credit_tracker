-- Tighten profiles RLS:
-- - "profiles self update" -> authenticated only (plus admins)

begin;

alter policy "profiles self update"
on public.profiles
to authenticated
using ((id = auth.uid()) OR auth_is_admin());

commit;
