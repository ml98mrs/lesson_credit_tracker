-- RLS: credit_lots write admin -> authenticated-only admin

begin;

alter policy "credit_lots write admin"
on public.credit_lots
to authenticated
using (auth_is_admin())
with check (auth_is_admin());

commit;
