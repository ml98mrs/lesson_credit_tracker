-- Tighten profiles RLS:
-- - "profiles self read" -> authenticated only (plus admins)

begin;

alter policy "profiles self read"
on public.profiles
to authenticated
using ((id = auth.uid()) OR auth_is_admin());

commit;
