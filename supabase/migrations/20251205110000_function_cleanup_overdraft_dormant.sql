-- 20251205_function_cleanup_overdraft_dormant.sql
-- Tidy-up:
--  1) Shared helper for overdraft settlement (award/invoice)
--  2) Shared helper for overdraft write-off
--  3) Make rpc_auto_dormant_students the canonical dormant RPC
--  4) Align is_current_student behaviour with its name

------------------------------------------------------------
-- 1. Shared overdraft settlement helper
------------------------------------------------------------

create or replace function public.fn_settle_overdraft_common(
  p_student_id         uuid,
  p_mode               text,  -- 'award' or 'invoice'
  p_award_reason_code  text,
  p_invoice_ref        text,
  p_note               text
)
returns jsonb
language plpgsql
as $function$
declare
  v_deficit         integer;
  v_now             timestamptz := now();
  v_actor           uuid;
  v_overdraft_lot   public.credit_lots%rowtype;
  v_before_granted  integer;
  v_after_granted   integer;
  v_details         jsonb;
begin
  if p_student_id is null then
    raise exception using message = 'student_id is required';
  end if;

  -- Mode-specific validation
  if p_mode = 'award' then
    if coalesce(trim(p_award_reason_code), '') = '' then
      raise exception using message = 'award_reason_code is required';
    end if;
  elsif p_mode = 'invoice' then
    if coalesce(trim(p_invoice_ref), '') = '' then
      raise exception using message = 'invoice_ref is required';
    end if;
  else
    raise exception using message = 'Unsupported overdraft settlement mode';
  end if;

  -- How much overdraft do we need to cover?
  v_deficit := public.fn_get_overdraft_deficit(p_student_id);

  v_actor := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;

  -- Find the overdraft lot
  select *
    into v_overdraft_lot
  from public.credit_lots
  where student_id = p_student_id
    and source_type = 'overdraft'
  limit 1;

  if not found then
    raise exception using message = 'Overdraft lot not found for student';
  end if;

  v_before_granted := coalesce(v_overdraft_lot.minutes_granted, 0);
  v_after_granted  := v_before_granted + v_deficit;

  -- Adjust overdraft lot so remaining becomes zero
  update public.credit_lots
     set minutes_granted   = v_after_granted,
         award_reason_code = case
                               when p_mode = 'award'
                               then coalesce(award_reason_code, p_award_reason_code)
                               else award_reason_code
                             end
   where id = v_overdraft_lot.id;

  -- Build details JSON with mode-specific fields
  v_details :=
    jsonb_build_object(
      'student_id',                 p_student_id,
      'settlement_mode',            p_mode,
      'added_minutes',              v_deficit,
      'previous_minutes_granted',   v_before_granted,
      'new_minutes_granted',        v_after_granted,
      'note', coalesce(
        p_note,
        case
          when p_mode = 'award'   then 'Overdraft settled as award'
          when p_mode = 'invoice' then 'Overdraft settled by invoice'
          else 'Overdraft settled'
        end
      )
    );

  if p_mode = 'award' then
    v_details := v_details || jsonb_build_object(
      'award_reason_code', p_award_reason_code
    );
  end if;

  if p_mode = 'invoice' then
    v_details := v_details || jsonb_build_object(
      'invoice_ref', p_invoice_ref
    );
  end if;

  insert into public.credit_lot_events (
    credit_lot_id,
    event_type,
    actor_id,
    created_at,
    details
  )
  values (
    v_overdraft_lot.id,
    case
      when p_mode = 'award'   then 'overdraft_settled_award'
      when p_mode = 'invoice' then 'overdraft_settled_invoice'
      else 'overdraft_settled'
    end,
    v_actor,
    v_now,
    v_details
  );

  return jsonb_build_object(
    'ok',                      true,
    'mode',                    p_mode,
    'student_id',              p_student_id,
    'minutes_settled',         v_deficit,
    'overdraft_credit_lot_id', v_overdraft_lot.id
  );
end;
$function$;


-- Rewrite rpc_award_overdraft to delegate to the helper
create or replace function public.rpc_award_overdraft(
  p_student_id        uuid,
  p_award_reason_code text,
  p_note              text default null
)
returns jsonb
language plpgsql
as $function$
begin
  if p_student_id is null then
    raise exception using message = 'student_id is required';
  end if;

  if coalesce(trim(p_award_reason_code), '') = '' then
    raise exception using message = 'award_reason_code is required';
  end if;

  return public.fn_settle_overdraft_common(
    p_student_id        => p_student_id,
    p_mode              => 'award',
    p_award_reason_code => p_award_reason_code,
    p_invoice_ref       => null,
    p_note              => p_note
  );
end;
$function$;


-- Rewrite rpc_invoice_overdraft to delegate to the helper
create or replace function public.rpc_invoice_overdraft(
  p_student_id uuid,
  p_invoice_ref text,
  p_note text default null
)
returns jsonb
language plpgsql
as $function$
begin
  if p_student_id is null then
    raise exception using message = 'student_id is required';
  end if;

  if coalesce(trim(p_invoice_ref), '') = '' then
    raise exception using message = 'invoice_ref is required';
  end if;

  return public.fn_settle_overdraft_common(
    p_student_id        => p_student_id,
    p_mode              => 'invoice',
    p_award_reason_code => null,
    p_invoice_ref       => p_invoice_ref,
    p_note              => p_note
  );
end;
$function$;


------------------------------------------------------------
-- 2. Shared overdraft write-off helper
------------------------------------------------------------

create or replace function public.fn_write_off_overdraft_common(
  p_student_id        uuid,
  p_reason_code       credit_write_off_reason,
  p_note              text,
  p_accounting_period text
)
returns jsonb
language plpgsql
as $function$
declare
  v_remaining    integer;
  v_to_write_off integer;
  v_now          timestamptz := now();
  v_actor        uuid;
  v_period       text;
  v_lot          record;
begin
  if p_student_id is null then
    raise exception using message = 'student_id is required';
  end if;

  v_actor := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  v_period := coalesce(p_accounting_period, to_char(v_now::date, 'YYYY'));

  -- 1. Compute remaining minutes (all lots)
  select coalesce(sum(minutes_remaining), 0)
    into v_remaining
  from public.v_credit_lot_remaining
  where student_id = p_student_id;

  -- Only handle negative balances here
  if v_remaining >= 0 then
    raise exception using message = 'No negative balance to write off';
  end if;

  v_to_write_off := -v_remaining; -- make it positive

  -- 2. Fix overdraft lots: set granted = allocated so remaining = 0
  for v_lot in
    select id, minutes_granted, minutes_allocated
      from public.credit_lots
     where student_id = p_student_id
       and source_type = 'overdraft'
  loop
    update public.credit_lots
       set minutes_granted = minutes_allocated
     where id = v_lot.id;
  end loop;

  -- 3. Insert into write-off ledger
  insert into public.credit_write_offs (
    student_id,
    credit_lot_id,
    direction,
    minutes,
    reason_code,
    note,
    accounting_period,
    created_at,
    created_by
  )
  values (
    p_student_id,
    null,
    'negative',
    v_to_write_off,
    p_reason_code,
    p_note,
    v_period,
    v_now,
    v_actor
  );

  -- 4. Mark student as past
  update public.students
     set status = 'past'
   where id = p_student_id;

  return jsonb_build_object(
    'ok',                  true,
    'student_id',          p_student_id,
    'direction',           'negative',
    'minutes_written_off', v_to_write_off,
    'accounting_period',   v_period
  );
end;
$function$;


-- Rewrite rpc_write_off_overdraft to use the helper
create or replace function public.rpc_write_off_overdraft(
  p_student_id        uuid,
  p_reason_code       text,
  p_note              text default null,
  p_accounting_period text default null
)
returns jsonb
language plpgsql
as $function$
begin
  if coalesce(trim(p_reason_code), '') = '' then
    raise exception using message = 'reason_code is required';
  end if;

  return public.fn_write_off_overdraft_common(
    p_student_id        => p_student_id,
    p_reason_code       => p_reason_code::credit_write_off_reason,
    p_note              => p_note,
    p_accounting_period => p_accounting_period
  );
end;
$function$;


-- Rewrite rpc_write_off_overdraft_credit to use the helper
create or replace function public.rpc_write_off_overdraft_credit(
  p_student_id        uuid,
  p_reason_code       credit_write_off_reason default 'overdraft_write_off',
  p_note              text default null,
  p_accounting_period text default null
)
returns jsonb
language plpgsql
as $function$
begin
  return public.fn_write_off_overdraft_common(
    p_student_id        => p_student_id,
    p_reason_code       => p_reason_code,
    p_note              => p_note,
    p_accounting_period => p_accounting_period
  );
end;
$function$;


------------------------------------------------------------
-- 3. Dormant students: make rpc_auto_dormant_students canonical
--    and have rpc_mark_students_dormant delegate to it.
------------------------------------------------------------

create or replace function public.rpc_mark_students_dormant(
  p_inactive_interval interval default '3 mons'
)
returns jsonb
language plpgsql
as $function$
begin
  -- Delegate to the canonical implementation which:
  --  - uses v_student_last_activity
  --  - checks remaining >= 0 via v_credit_lot_remaining
  --  - writes student_status_events
  return public.rpc_auto_dormant_students(p_inactive_interval);
end;
$function$;


------------------------------------------------------------
-- 4. is_current_student: align behaviour with name
------------------------------------------------------------

create or replace function public.is_current_student(s_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.students s
    where s.id = s_id
      and s.profile_id = auth.uid()
      and s.status = 'current'
  );
$function$;
