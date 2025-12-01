create or replace function trg_prevent_delete_allocated_credit_lot()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.allocations a
    where a.credit_lot_id = old.id
  ) then
    raise exception
      'Cannot delete credit lot % because it has lesson allocations. Delete the lessons (and their allocations) first.',
      old.id;
  end if;

  return old;
end;
$$;

drop trigger if exists prevent_delete_allocated_credit_lot
on public.credit_lots;

create trigger prevent_delete_allocated_credit_lot
before delete on public.credit_lots
for each row
execute function trg_prevent_delete_allocated_credit_lot();
