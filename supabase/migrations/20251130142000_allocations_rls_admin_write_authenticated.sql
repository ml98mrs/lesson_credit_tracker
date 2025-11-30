-- RLS: allocations admin write -> authenticated-only admin

begin;

alter policy "allocations admin write"
on public.allocations
to authenticated
using (auth_is_admin())
with check (auth_is_admin());

commit;
