-- Stage 5: rpc_log_teacher_expense
-- - switch to SECURITY INVOKER
-- - enforce teacher↔student assignment inline

begin;

create or replace function public.rpc_log_teacher_expense(
  p_incurred_at      timestamptz,
  p_amount_pennies   integer,
  p_category         text,
  p_description      text,
  p_student_id       uuid
)
returns teacher_expenses
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  v_teacher_id          uuid;
  v_row                 public.teacher_expenses;
  v_month_start         date;
  v_existing_invoice_id bigint;
begin
  select t.id
    into v_teacher_id
  from public.teachers t
  where t.profile_id = auth.uid();

  if v_teacher_id is null then
    raise exception 'No teacher record found for current user';
  end if;

  if p_amount_pennies is null or p_amount_pennies <= 0 then
    raise exception 'Amount must be positive (in pennies)';
  end if;

  if p_category is null
     or p_category not in ('drinks', 'teaching_resources', 'other') then
    raise exception 'Invalid category: %', p_category;
  end if;

  if p_student_id is null then
    raise exception 'student_id is required for an expense';
  end if;

  if not exists (
    select 1
    from public.students s
    where s.id = p_student_id
  ) then
    raise exception 'Student % not found', p_student_id;
  end if;

  if not exists (
    select 1
    from public.student_teacher st
    where st.student_id = p_student_id
      and st.teacher_id = v_teacher_id
  ) then
    raise exception 'Teacher is not assigned to this student';
  end if;

  v_month_start :=
    date_trunc('month', (p_incurred_at at time zone 'Europe/London'))::date;

  select ti.id
    into v_existing_invoice_id
  from public.teacher_invoices ti
  where ti.teacher_id = v_teacher_id
    and ti.month_start = v_month_start
    and ti.status = 'paid'
  limit 1;

  if v_existing_invoice_id is not null then
    raise exception
      'You can''t log a new expense for % because the invoice for that month has already been marked as paid. Please contact the office if you need to add or change something.',
      to_char(v_month_start, 'Mon YYYY')
      using detail =
        'Month start: '
        || v_month_start::text
        || ', invoice id: '
        || v_existing_invoice_id::text;
  end if;

  insert into public.teacher_expenses (
    teacher_id,
    student_id,
    incurred_at,
    amount_pennies,
    status,
    category,
    description
  )
  values (
    v_teacher_id,
    p_student_id,
    p_incurred_at,
    p_amount_pennies,
    'pending',
    p_category,
    nullif(p_description, '')
  )
  returning * into v_row;

  return v_row;
end;
$function$;

commit;
