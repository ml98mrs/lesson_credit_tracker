create or replace function trg_block_paid_teacher_expense_delete()
returns trigger
language plpgsql
as $$
declare
  v_month_start date;
begin
  -- Derive month_start from incurred_at in UTC, to match app logic
  v_month_start := date_trunc(
    'month',
    old.incurred_at at time zone 'UTC'
  )::date;

  if exists (
    select 1
    from public.teacher_invoices ti
    where ti.teacher_id = old.teacher_id
      and ti.month_start = v_month_start
      and ti.status = 'paid'
  ) then
    raise exception
      'Cannot delete teacher expense for this month because a PAID teacher invoice exists. Delete the invoice first.';
  end if;

  return old;
end;
$$;

drop trigger if exists prevent_delete_paid_teacher_expense
on public.teacher_expenses;

create trigger prevent_delete_paid_teacher_expense
before delete on public.teacher_expenses
for each row
execute function trg_block_paid_teacher_expense_delete();
