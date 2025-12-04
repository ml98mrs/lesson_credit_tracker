


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."credit_lot_state" AS ENUM (
    'open',
    'closed',
    'expired',
    'cancelled'
);


ALTER TYPE "public"."credit_lot_state" OWNER TO "postgres";


CREATE TYPE "public"."credit_write_off_direction" AS ENUM (
    'positive',
    'negative'
);


ALTER TYPE "public"."credit_write_off_direction" OWNER TO "postgres";


CREATE TYPE "public"."credit_write_off_reason" AS ENUM (
    'manual_write_off',
    'expired_credit',
    'overdraft_write_off',
    'adjustment'
);


ALTER TYPE "public"."credit_write_off_reason" OWNER TO "postgres";


CREATE TYPE "public"."delivery" AS ENUM (
    'online',
    'f2f'
);


ALTER TYPE "public"."delivery" OWNER TO "postgres";


CREATE TYPE "public"."expiry_policy" AS ENUM (
    'none',
    'mandatory',
    'advisory'
);


ALTER TYPE "public"."expiry_policy" OWNER TO "postgres";


CREATE TYPE "public"."hazard_type" AS ENUM (
    'delivery_f2f_on_online',
    'delivery_online_on_f2f',
    'length_restriction_mismatch',
    'negative_balance',
    'mandatory_expiry_breached',
    'snc_overuse',
    'length_too_short',
    'overdraft_allocation',
    'expiry_mandatory_breached'
);


ALTER TYPE "public"."hazard_type" OWNER TO "postgres";


CREATE TYPE "public"."length_cat" AS ENUM (
    '60',
    '90',
    '120',
    'none'
);


ALTER TYPE "public"."length_cat" OWNER TO "postgres";


CREATE TYPE "public"."lesson_state" AS ENUM (
    'pending',
    'confirmed',
    'declined',
    'cancelled_snc'
);


ALTER TYPE "public"."lesson_state" OWNER TO "postgres";


COMMENT ON TYPE "public"."lesson_state" IS 'Evolvable enum. Valid values: pending, confirmed, declined. 
Legacy: cancelled_snc (no longer used).';



CREATE TYPE "public"."snc_mode" AS ENUM (
    'none',
    'free',
    'charged'
);


ALTER TYPE "public"."snc_mode" OWNER TO "postgres";


CREATE TYPE "public"."student_status" AS ENUM (
    'current',
    'dormant',
    'past'
);


ALTER TYPE "public"."student_status" OWNER TO "postgres";


CREATE TYPE "public"."teacher_status" AS ENUM (
    'current',
    'inactive',
    'potential',
    'past'
);


ALTER TYPE "public"."teacher_status" OWNER TO "postgres";


CREATE TYPE "public"."tier" AS ENUM (
    'basic',
    'premium',
    'elite'
);


ALTER TYPE "public"."tier" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'student',
    'teacher',
    'admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;


ALTER FUNCTION "public"."auth_is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_delivery_hazard_type"("p_lesson_delivery" "public"."delivery", "p_lot_delivery_restriction" "public"."delivery") RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    CASE
      WHEN p_lesson_delivery = 'f2f'::public.delivery
           AND p_lot_delivery_restriction = 'online'::public.delivery
        THEN 'delivery_f2f_on_online'
      WHEN p_lesson_delivery = 'online'::public.delivery
           AND p_lot_delivery_restriction = 'f2f'::public.delivery
        THEN 'delivery_online_on_f2f'
      ELSE NULL
    END;
$$;


ALTER FUNCTION "public"."fn_delivery_hazard_type"("p_lesson_delivery" "public"."delivery", "p_lot_delivery_restriction" "public"."delivery") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_get_overdraft_deficit"("p_student_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
declare
  v_remaining integer;
begin
  if p_student_id is null then
    raise exception using message = 'student_id is required';
  end if;

  select coalesce(sum(minutes_remaining), 0)
    into v_remaining
  from public.v_credit_lot_remaining
  where student_id = p_student_id;

  -- Negative means overdraft; positive/zero means no deficit.
  if v_remaining >= 0 then
    raise exception using message = 'No negative balance to settle';
  end if;

  return -v_remaining;  -- positive deficit
end;
$$;


ALTER FUNCTION "public"."fn_get_overdraft_deficit"("p_student_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_delivery_mismatch"("p_lesson_delivery" "public"."delivery", "p_lot_delivery_restriction" "public"."delivery") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT public.fn_delivery_hazard_type(
           p_lesson_delivery,
           p_lot_delivery_restriction
         ) IS NOT NULL;
$$;


ALTER FUNCTION "public"."fn_is_delivery_mismatch"("p_lesson_delivery" "public"."delivery", "p_lot_delivery_restriction" "public"."delivery") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_dynamic_low"("remaining_hours" numeric, "avg_month_hours" numeric) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
    select avg_month_hours is not null
       and avg_month_hours > 0
       and (remaining_hours - avg_month_hours) < 4.0;
$$;


ALTER FUNCTION "public"."fn_is_dynamic_low"("remaining_hours" numeric, "avg_month_hours" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_generic_low_credit"("remaining_minutes" integer) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
    select remaining_minutes <= 360;
$$;


ALTER FUNCTION "public"."fn_is_generic_low_credit"("remaining_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_heavy_user"("avg_month_minutes" numeric) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
    -- 12 * 60 minutes
    select avg_month_minutes >= 720;
$$;


ALTER FUNCTION "public"."fn_is_heavy_user"("avg_month_minutes" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_length_restriction_mismatch"("p_lot_length" "public"."length_cat", "p_duration_min" integer) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
declare
  v_threshold int;
begin
  -- No restriction → never a mismatch
  if p_lot_length is null or p_lot_length = 'none'::public.length_cat then
    return false;
  end if;

  -- Use the same threshold logic you already use for length hazards
  v_threshold := public.fn_length_threshold(p_lot_length);

  -- If there’s no threshold defined, be conservative and say “no mismatch”
  if v_threshold is null then
    return false;
  end if;

  -- Lesson is shorter than the lot’s required threshold → mismatch
  return p_duration_min < v_threshold;
end;
$$;


ALTER FUNCTION "public"."fn_is_length_restriction_mismatch"("p_lot_length" "public"."length_cat", "p_duration_min" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_length_too_short"("p_length_cat" "public"."length_cat", "p_duration_min" integer) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    CASE
      WHEN public.fn_length_threshold(p_length_cat) IS NULL THEN FALSE
      ELSE p_duration_min < public.fn_length_threshold(p_length_cat)
    END;
$$;


ALTER FUNCTION "public"."fn_is_length_too_short"("p_length_cat" "public"."length_cat", "p_duration_min" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_snc_lesson"("is_snc" boolean, "lesson_state" "public"."lesson_state") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
    select is_snc = true and lesson_state = 'confirmed';
$$;


ALTER FUNCTION "public"."fn_is_snc_lesson"("is_snc" boolean, "lesson_state" "public"."lesson_state") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_snc_overuse"("snc_count" bigint) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
    select snc_count > 3;
$$;


ALTER FUNCTION "public"."fn_is_snc_overuse"("snc_count" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_length_threshold"("p_length_cat" "public"."length_cat") RETURNS integer
    LANGUAGE "sql" STABLE
    AS $$
  SELECT CASE p_length_cat
           WHEN '90'::public.length_cat  THEN 75
           WHEN '120'::public.length_cat THEN 105
           ELSE NULL
         END;
$$;


ALTER FUNCTION "public"."fn_length_threshold"("p_length_cat" "public"."length_cat") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_plan_lesson_allocation"("p_lesson_id" "uuid", "p_admin_override" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
/* ============================================================================
 * fn_plan_lesson_allocation
 * ---------------------------------------------------------------------------
 * Signature:
 *   fn_plan_lesson_allocation(
 *     p_lesson_id      uuid,
 *     p_admin_override boolean
 *   ) RETURNS jsonb
 *
 * Purpose:
 *   Pure "planner" for lesson allocation. NO WRITES.
 *   Computes how a pending lesson *would* allocate against credit lots,
 *   including SNC policy and hazard flags, and returns a JSON plan.
 *
 * Inputs:
 *   p_lesson_id      - Target lesson (must be state = 'pending').
 *   p_admin_override - If true, planner may use expired mandatory lots.
 *
 * Behaviour (high level):
 *   1. Load & lock the lesson row
 *   2. Apply SNC policy using student tier
 *   3. Plan allocations for normal / paid SNC lessons
 *   4. Overdraft safety net
 *   5. Return JSON plan
 * ========================================================================== */
declare
  -- Lesson snapshot
  v_student      uuid;
  v_teacher      uuid;
  v_delivery     public.delivery;
  v_length       public.length_cat;
  v_duration     int;
  v_state        public.lesson_state;
  v_is_snc       boolean;
  v_occurred_at  timestamptz;

  -- Tier / SNC
  v_tier         public.tier;
  v_is_free_snc  boolean := false;
  v_month_start  date;
  v_month_end    date;
  v_first_snc_id uuid;

  -- Allocation planning
  v_needed            int;
  v_taken             int;
  v_plan_steps        jsonb := '[]'::jsonb;
  v_counter_delivery  boolean := false;
  v_length_violation  boolean := false;
  v_negative_balance  boolean := false;

  -- NEW: for UI – should we even show the expiry override option?
  v_has_mandatory_expired boolean := false;

  rec record;
begin
  --------------------------------------------------------------------
  -- 1) Load & validate the lesson (same guards as rpc_confirm_lesson)
  --------------------------------------------------------------------
  select student_id,
         teacher_id,
         delivery,
         length_cat,
         duration_min,
         state,
         is_snc,
         occurred_at
    into v_student,
         v_teacher,
         v_delivery,
         v_length,
         v_duration,
         v_state,
         v_is_snc,
         v_occurred_at
  from public.lessons
  where id = p_lesson_id
  for update;

  if not found then
    raise exception 'fn_plan_lesson_allocation: Lesson % not found', p_lesson_id
      using errcode = 'P0002';
  end if;

  if v_state <> 'pending' then
    raise exception 'fn_plan_lesson_allocation: Lesson % is not pending (state=%)',
      p_lesson_id, v_state;
  end if;

  --------------------------------------------------------------------
  -- 2) SNC policy (mirror existing rpc_confirm_lesson logic)
  --------------------------------------------------------------------
  if v_is_snc then
    -- Current tier
    select s.tier
      into v_tier
    from public.students s
    where s.id = v_student;

    -- BASIC → never free
    if v_tier = 'basic' then
      v_is_free_snc := false;

    -- PREMIUM / ELITE → earliest SNC in that calendar month is free
    elsif v_tier in ('premium', 'elite') then
      v_month_start := date_trunc('month', v_occurred_at)::date;
      v_month_end   := (v_month_start + interval '1 month')::date;

      select l.id
        into v_first_snc_id
      from public.lessons l
      where l.student_id = v_student
        and l.is_snc = true
        and l.state <> 'declined'
        and l.occurred_at >= v_month_start
        and l.occurred_at <  v_month_end
      order by l.occurred_at, l.id
      limit 1;

      v_is_free_snc := (p_lesson_id = v_first_snc_id);

    -- NULL (or other) → exactly one free SNC ever
    else
      select count(*) = 0
        into v_is_free_snc
      from public.lessons l
      where l.student_id = v_student
        and l.is_snc = true
        and l.state = 'confirmed'
        and l.snc_mode = 'free'::public.snc_mode;
    end if;
  end if;

  -- If this is a FREE SNC: no allocations, no overdraft, no hazards in plan
  if v_is_snc and v_is_free_snc then
    return jsonb_build_object(
      'lessonId',        p_lesson_id,
      'studentId',       v_student,
      'teacherId',       v_teacher,
      'isSnc',           v_is_snc,
      'isFreeSnc',       v_is_free_snc,
      'sncMode',         'free',
      'tier',            v_tier,
      'plan',            '[]'::jsonb,
      'counterDelivery', false,
      'lengthViolation', false,
      'negativeBalance', false,
      'hasMandatoryExpiredLots', false
    );
  end if;

  --------------------------------------------------------------------
  -- 2b) Detect expired mandatory lots for this student
  --     (used by UI to decide whether to show expiry override)
  --------------------------------------------------------------------
  select exists (
    select 1
    from public.v_credit_lot_remaining r
    join public.credit_lots cl on cl.id = r.credit_lot_id
    where r.student_id = v_student
      and r.minutes_remaining > 0
      and (cl.state = 'open' or cl.state is null)
      and cl.source_type <> 'overdraft'
      and cl.expiry_policy = 'mandatory'
      and cl.expiry_date < current_date
  )
  into v_has_mandatory_expired;

  --------------------------------------------------------------------
  -- 3) Normal / paid SNC allocation planner (no DB writes)
  --------------------------------------------------------------------
  v_needed := v_duration;

  for rec in
    with candidate_lots as (
      select
        cl.id                  as credit_lot_id,
        cl.source_type,
        cl.start_date,
        cl.expiry_date,
        cl.expiry_policy,
        cl.created_at,
        cl.delivery_restriction,
        cl.length_restriction,
        cl.tier_restriction,
        r.minutes_remaining
      from public.v_credit_lot_remaining r
      join public.credit_lots cl on cl.id = r.credit_lot_id
      where r.student_id = v_student
        and r.minutes_remaining > 0
        and (cl.state = 'open' or cl.state is null)

        -- NOTE: no length_restriction hard filter here.
        -- Length mismatch is handled as a hazard, not a hard block.

        -- do NOT use overdraft here
        and cl.source_type <> 'overdraft'

        -- expiry policy: override flag permits expired mandatory lots
        and (
          p_admin_override
          or cl.expiry_policy <> 'mandatory'
          or cl.expiry_date is null
          or cl.expiry_date >= current_date
        )
    ),
    ordered as (
      select *
      from candidate_lots
      order by
        -- prefer matching/unrestricted delivery first
        case
          when delivery_restriction is null
               or delivery_restriction = v_delivery then 0
          else 1
        end,
        -- then source_type priority
        case source_type
          when 'invoice'    then 0
          when 'award'      then 1
          when 'adjustment' then 2
          else 3
        end,
        -- FIFO inside band
        expiry_date nulls last,
        start_date,
        created_at,
        credit_lot_id
    )
    select *
    from ordered
  loop
    exit when v_needed <= 0;
    if rec.minutes_remaining <= 0 then
      continue;
    end if;

    v_taken := least(rec.minutes_remaining, v_needed);

    -- Delivery mismatch hazard (same predicate as v_allocation_delivery_hazards_raw)
    if public.fn_is_delivery_mismatch(v_delivery, rec.delivery_restriction) then
      v_counter_delivery := true;
    end if;

    -- Length restriction vs actual duration (lot-based mismatch)
    if public.fn_is_length_restriction_mismatch(rec.length_restriction, v_duration) then
      v_length_violation := true;
    end if;

    v_plan_steps := v_plan_steps || jsonb_build_array(
      jsonb_build_object(
        'creditLotId',          rec.credit_lot_id,
        'sourceType',           rec.source_type,
        'deliveryRestriction',  rec.delivery_restriction,
        'lengthRestriction',    rec.length_restriction,
        'tierRestriction',      rec.tier_restriction,
        'fromRemaining',        rec.minutes_remaining,
        'allocate',             v_taken,
        'toRemaining',          rec.minutes_remaining - v_taken,
        'counterDelivery',      public.fn_is_delivery_mismatch(
                                  v_delivery,
                                  rec.delivery_restriction
                                ),
        'lengthViolation',      public.fn_is_length_restriction_mismatch(
                                  rec.length_restriction,
                                  v_duration
                                ),
        'overdraft',            false
      )
    );

    v_needed := v_needed - v_taken;
  end loop;

  --------------------------------------------------------------------
  -- 4) Overdraft safety net → sets negativeBalance flag
  --------------------------------------------------------------------
  if v_needed > 0 then
    v_negative_balance := true;

    v_plan_steps := v_plan_steps || jsonb_build_array(
      jsonb_build_object(
        'creditLotId',          null,        -- actual overdraft lot chosen at confirm time
        'sourceType',           'overdraft',
        'deliveryRestriction',  null,
        'lengthRestriction',    null,
        'tierRestriction',      null,
        'fromRemaining',        0,
        'allocate',             v_needed,
        'toRemaining',          -v_needed,
        'counterDelivery',      false,
        'lengthViolation',      false,
        'overdraft',            true
      )
    );
  end if;

  --------------------------------------------------------------------
  -- 5) Return JSON plan (no DB writes)
  --------------------------------------------------------------------
  return jsonb_build_object(
    'lessonId',        p_lesson_id,
    'studentId',       v_student,
    'teacherId',       v_teacher,
    'isSnc',           v_is_snc,
    'isFreeSnc',       v_is_free_snc,
    'sncMode',         case
                         when not v_is_snc      then 'none'
                         when v_is_free_snc     then 'free'
                         else 'charged'
                       end,
    'tier',            v_tier,
    'plan',            v_plan_steps,
    'counterDelivery', v_counter_delivery,
    'lengthViolation', v_length_violation,
    'negativeBalance', v_negative_balance,
    'hasMandatoryExpiredLots', v_has_mandatory_expired
  );
end;
$$;


ALTER FUNCTION "public"."fn_plan_lesson_allocation"("p_lesson_id" "uuid", "p_admin_override" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_settle_overdraft_common"("p_student_id" "uuid", "p_mode" "text", "p_award_reason_code" "text", "p_invoice_ref" "text", "p_note" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_settle_overdraft_common"("p_student_id" "uuid", "p_mode" "text", "p_award_reason_code" "text", "p_invoice_ref" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_write_off_overdraft_common"("p_student_id" "uuid", "p_reason_code" "public"."credit_write_off_reason", "p_note" "text", "p_accounting_period" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_write_off_overdraft_common"("p_student_id" "uuid", "p_reason_code" "public"."credit_write_off_reason", "p_note" "text", "p_accounting_period" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_overdraft_lot"("p_student_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$DECLARE
  v_lot_id uuid;
  v_actor  uuid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
BEGIN
  IF p_student_id IS NULL THEN
    RAISE EXCEPTION 'student_id is required';
  END IF;

  -- Try to create the overdraft lot idempotently
  INSERT INTO public.credit_lots (
    id,
    student_id,
    source_type,
    external_ref,
    minutes_granted,
    start_date,
    expiry_policy,
    state,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    p_student_id,
    'overdraft',              -- ✅ consistent with allocation ordering
    'OVERDRAFT',              -- raw ref; external_ref_norm will be generated
    0,                        -- overdraft bucket starts at 0; can be “overdrawn” by allocations
    current_date,
    'none'::public.expiry_policy,
    'open',                   -- if state is enum, cast: 'open'::public.credit_lot_state
    now()
  )
  ON CONFLICT ON CONSTRAINT uq_credit_lots_student_source_extrefnorm
  DO NOTHING
  RETURNING id INTO v_lot_id;

  -- If it already existed, fetch its id
  IF v_lot_id IS NULL THEN
    SELECT id
      INTO v_lot_id
    FROM public.credit_lots
    WHERE student_id = p_student_id
      AND source_type = 'overdraft'
      AND external_ref_norm = upper(btrim('OVERDRAFT'))
    LIMIT 1;
  ELSE
    -- Optional: audit creation
    INSERT INTO public.credit_lot_events (credit_lot_id, event_type, actor_id, details)
    VALUES (
      v_lot_id,
      'created',
      v_actor,
      jsonb_build_object(
        'source_type', 'overdraft',
        'external_ref', 'OVERDRAFT',
        'minutes_granted', 0,
        'start_date', current_date,
        'expiry_policy', 'none'
      )
    );
  END IF;

  IF v_lot_id IS NULL THEN
    RAISE EXCEPTION 'failed to get or create overdraft lot for student %', p_student_id;
  END IF;

  RETURN v_lot_id;
END;$$;


ALTER FUNCTION "public"."get_or_create_overdraft_lot"("p_student_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 'student')
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_student"("s_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.students s
    where s.id = s_id
      and s.profile_id = auth.uid()
      and s.status = 'current'
  );
$$;


ALTER FUNCTION "public"."is_current_student"("s_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_teacher_assigned_to_student"("s_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.student_teacher st
    join public.teachers t on t.id = st.teacher_id
    where st.student_id = s_id
      and t.profile_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_teacher_assigned_to_student"("s_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_student_record_queries_seen"("p_query_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_student_id uuid;
begin
  -- Resolve the caller's student_id from auth.uid()
  select s.id into v_student_id
  from students s
  where s.profile_id = auth.uid();

  if v_student_id is null then
    raise exception 'No student record for this user';
  end if;

  update student_record_queries
  set student_seen_at = now()
  where id = any(p_query_ids)
    and student_id = v_student_id;
end;
$$;


ALTER FUNCTION "public"."mark_student_record_queries_seen"("p_query_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_admin_assign_student_teacher"("p_student_id" "uuid", "p_teacher_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  insert into student_teacher (student_id, teacher_id)
  values (p_student_id, p_teacher_id)
  on conflict (student_id, teacher_id) do nothing;
$$;


ALTER FUNCTION "public"."rpc_admin_assign_student_teacher"("p_student_id" "uuid", "p_teacher_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_admin_create_student"("p_auth_user_id" "uuid", "p_full_name" "text", "p_preferred_name" "text" DEFAULT NULL::"text", "p_timezone" "text" DEFAULT 'Europe/London'::"text", "p_tier" "public"."tier" DEFAULT NULL::"public"."tier", "p_teacher_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_student_id uuid;
begin
  -- 1) Update existing profile row created by auth trigger
  update profiles
  set
    full_name      = p_full_name,
    preferred_name = nullif(p_preferred_name, ''),
    timezone       = coalesce(p_timezone, 'Europe/London'),
    role           = 'student'
  where id = p_auth_user_id;

  -- Sanity check that a profile row existed
  if not found then
    raise exception
      'rpc_admin_create_student: no profile row found for auth_user_id=%',
      p_auth_user_id;
  end if;

  -- 2) Create student row
  -- p_tier may be NULL => "legacy / no tier yet"
  insert into students (profile_id, tier)
  values (p_auth_user_id, p_tier)
  returning id into v_student_id;

  -- 3) Optional student-teacher pairing
  if p_teacher_id is not null then
    insert into student_teacher (student_id, teacher_id)
    values (v_student_id, p_teacher_id);
  end if;

  return v_student_id;
end;
$$;


ALTER FUNCTION "public"."rpc_admin_create_student"("p_auth_user_id" "uuid", "p_full_name" "text", "p_preferred_name" "text", "p_timezone" "text", "p_tier" "public"."tier", "p_teacher_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_admin_unassign_student_teacher"("p_student_id" "uuid", "p_teacher_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  delete from student_teacher
  where student_id = p_student_id
    and teacher_id = p_teacher_id;
$$;


ALTER FUNCTION "public"."rpc_admin_unassign_student_teacher"("p_student_id" "uuid", "p_teacher_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_auto_dormant_students"("p_inactive_interval" interval) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_cutoff timestamptz := now() - p_inactive_interval;
  v_updated int;
begin
  -- Safety: don’t allow negative or zero interval
  if p_inactive_interval <= interval '0' then
    raise exception using message = 'p_inactive_interval must be positive';
  end if;

  -- Update:
  --  - only current students
  --  - with NON-NEGATIVE remaining credit (>= 0)
  --  - whose last_activity_at is older than the cutoff
  with candidates as (
    select
      s.id as student_id
    from public.students s
    join public.v_student_last_activity a
      on a.student_id = s.id
    join public.v_credit_lot_remaining v
      on v.student_id = s.id
    where s.status = 'current'
    group by s.id, a.last_activity_at
    having
      coalesce(sum(v.minutes_remaining), 0) >= 0
      and a.last_activity_at < v_cutoff
  ),
  updated as (
    update public.students s
       set status = 'dormant'
    from candidates c
    where s.id = c.student_id
    returning s.id as student_id
  )
  insert into public.student_status_events (
    student_id,
    old_status,
    new_status,
    is_auto
  )
  select
    u.student_id,
    'current'::public.student_status,
    'dormant'::public.student_status,
    true
  from updated u;

  -- row_count is now the number of inserted rows = number of students updated
  get diagnostics v_updated = row_count;

  return jsonb_build_object(
    'ok', true,
    'cutoff', v_cutoff,
    'interval', p_inactive_interval,
    'students_marked_dormant', v_updated
  );
end;
$$;


ALTER FUNCTION "public"."rpc_auto_dormant_students"("p_inactive_interval" interval) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."credit_lots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "source_type" "text" NOT NULL,
    "award_reason_code" "text",
    "external_ref" "text",
    "minutes_granted" integer NOT NULL,
    "delivery_restriction" "public"."delivery",
    "tier_restriction" "public"."tier",
    "length_restriction" "public"."length_cat",
    "start_date" "date" NOT NULL,
    "expiry_policy" "public"."expiry_policy" DEFAULT 'none'::"public"."expiry_policy" NOT NULL,
    "expiry_date" "date",
    "state" "public"."credit_lot_state" DEFAULT 'open'::"public"."credit_lot_state" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "external_ref_norm" "text" GENERATED ALWAYS AS ("upper"("btrim"("external_ref"))) STORED,
    "amount_pennies" integer,
    CONSTRAINT "credit_lots_amount_pennies_check" CHECK ((("amount_pennies" IS NULL) OR ("amount_pennies" >= 0))),
    CONSTRAINT "credit_lots_award_reason_guard" CHECK (((("source_type" = 'award'::"text") AND ("award_reason_code" IS NOT NULL)) OR (("source_type" <> 'award'::"text") AND ("award_reason_code" IS NULL)))),
    CONSTRAINT "credit_lots_expiry_guard" CHECK (((("expiry_policy" = 'none'::"public"."expiry_policy") AND ("expiry_date" IS NULL)) OR (("expiry_policy" = ANY (ARRAY['mandatory'::"public"."expiry_policy", 'advisory'::"public"."expiry_policy"])) AND ("expiry_date" IS NOT NULL)))),
    CONSTRAINT "credit_lots_external_ref_required_for_invoice" CHECK ((("source_type" <> 'invoice'::"text") OR ("external_ref" IS NOT NULL))),
    CONSTRAINT "credit_lots_invoice_amount_required" CHECK ((("source_type" <> 'invoice'::"text") OR (("amount_pennies" IS NOT NULL) AND ("amount_pennies" > 0)))),
    CONSTRAINT "credit_lots_minutes_granted_check" CHECK (("minutes_granted" >= 0)),
    CONSTRAINT "credit_lots_overdraft_ref_guard" CHECK ((("source_type" <> 'overdraft'::"text") OR ("external_ref_norm" = 'OVERDRAFT'::"text"))),
    CONSTRAINT "credit_lots_source_type_check" CHECK (("source_type" = ANY (ARRAY['invoice'::"text", 'award'::"text", 'adjustment'::"text", 'overdraft'::"text"])))
);


ALTER TABLE "public"."credit_lots" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_award_minutes"("p_student_id" "uuid", "p_minutes_granted" integer, "p_start_date" "date", "p_award_reason_code" "text") RETURNS "public"."credit_lots"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$DECLARE
  v_row   public.credit_lots%rowtype;
  v_actor uuid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  v_code  text := btrim(p_award_reason_code);
BEGIN
  -- Validation
  IF p_student_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'student_id is required';
  END IF;
  IF p_minutes_granted IS NULL OR p_minutes_granted <= 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'minutes_granted must be a positive integer';
  END IF;
  IF p_start_date IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'start_date is required';
  END IF;
  IF COALESCE(v_code,'') = '' THEN
    RAISE EXCEPTION USING MESSAGE = 'award_reason_code is required';
  END IF;

  -- Ensure award reason exists
  IF NOT EXISTS (SELECT 1 FROM public.award_reasons r WHERE r.code = v_code) THEN
    RAISE EXCEPTION USING MESSAGE = 'award_reason_code not recognised';
  END IF;

  -- Insert award lot with NO EXPIRY (policy = none)
  INSERT INTO public.credit_lots (
    id,
    student_id,
    source_type,
    award_reason_code,
    external_ref,
    minutes_granted,
    delivery_restriction,
    tier_restriction,
    length_restriction,
    start_date,
    expiry_policy,
    expiry_date,
    state,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    p_student_id,
    'award',
    v_code,
    NULL,
    p_minutes_granted,
    NULL,
    NULL,
    'none'::public.length_cat,
    p_start_date,
    'none'::public.expiry_policy,
    NULL,
    'open',
    now()
  )
  RETURNING * INTO v_row;

  -- Audit
  INSERT INTO public.credit_lot_events(credit_lot_id, event_type, actor_id, details)
  VALUES (
    v_row.id,
    'created',
    v_actor,
    jsonb_build_object(
      'source_type','award',
      'award_reason_code', v_code,
      'minutes_granted', p_minutes_granted,
      'start_date', p_start_date,
      'expiry_policy','none'
    )
  );

  RETURN v_row;
END;$$;


ALTER FUNCTION "public"."rpc_award_minutes"("p_student_id" "uuid", "p_minutes_granted" integer, "p_start_date" "date", "p_award_reason_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_award_overdraft"("p_student_id" "uuid", "p_award_reason_code" "text", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."rpc_award_overdraft"("p_student_id" "uuid", "p_award_reason_code" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_cleanup_past_students_lessons"("p_min_age" interval DEFAULT '6 mons'::interval, "p_dry_run" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_cutoff timestamptz := now() - p_min_age;
  v_candidate_students uuid[];
  v_lesson_ids uuid[];
  v_alloc_count int := 0;
  v_lesson_count int := 0;
begin
  if p_min_age <= interval '0' then
    raise exception using message = 'p_min_age must be positive';
  end if;

  -- 1) Which PAST students are safe to clean?
  select array_agg(student_id)
    into v_candidate_students
  from public.v_past_students_cleanup_candidates
  where remaining_minutes = 0
    and last_activity_at < v_cutoff;

  if v_candidate_students is null or array_length(v_candidate_students, 1) = 0 then
    return jsonb_build_object(
      'ok', true,
      'cutoff', v_cutoff,
      'dry_run', p_dry_run,
      'students_considered', 0,
      'lessons_deleted', 0,
      'allocations_deleted', 0
    );
  end if;

  -- 2) All lessons for those students older than cutoff
  select array_agg(id)
    into v_lesson_ids
  from public.lessons
  where student_id = any (v_candidate_students)
    and occurred_at < v_cutoff;

  if v_lesson_ids is null or array_length(v_lesson_ids, 1) = 0 then
    return jsonb_build_object(
      'ok', true,
      'cutoff', v_cutoff,
      'dry_run', p_dry_run,
      'students_considered', array_length(v_candidate_students, 1),
      'lessons_deleted', 0,
      'allocations_deleted', 0
    );
  end if;

  -- 3) Count allocations + lessons we WOULD delete
  select count(*)
    into v_alloc_count
  from public.allocations
  where lesson_id = any (v_lesson_ids);

  select count(*)
    into v_lesson_count
  from public.lessons
  where id = any (v_lesson_ids);

  -- 4) If dry-run, stop here
  if p_dry_run then
    return jsonb_build_object(
      'ok', true,
      'cutoff', v_cutoff,
      'dry_run', true,
      'students_considered', array_length(v_candidate_students, 1),
      'lessons_deleted', v_lesson_count,
      'allocations_deleted', v_alloc_count
    );
  end if;

  -- 5) Actual deletion: allocations first, then lessons
  delete from public.allocations
  where lesson_id = any (v_lesson_ids);

  delete from public.lessons
  where id = any (v_lesson_ids);

  return jsonb_build_object(
    'ok', true,
    'cutoff', v_cutoff,
    'dry_run', false,
    'students_considered', array_length(v_candidate_students, 1),
    'lessons_deleted', v_lesson_count,
    'allocations_deleted', v_alloc_count
  );
end;
$$;


ALTER FUNCTION "public"."rpc_cleanup_past_students_lessons"("p_min_age" interval, "p_dry_run" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_confirm_lesson"("p_lesson_id" "uuid", "p_admin_override" boolean, "p_override_reason" "text", "p_reallocate" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$/* ============================================================================
 * rpc_confirm_lesson
 * ---------------------------------------------------------------------------
 * Signature:
 *   rpc_confirm_lesson(
 *     p_lesson_id      uuid,
 *     p_admin_override boolean,
 *     p_override_reason text,
 *     p_reallocate     boolean
 *   ) RETURNS jsonb
 *
 * Purpose:
 *   Confirm a pending lesson using the DB planner.
 *   Applies the JSON plan from fn_plan_lesson_allocation as real allocations,
 *   handles SNC modes, optional reallocation, and overdraft lots.
 *
 * Inputs:
 *   p_lesson_id       - Target lesson (must be state = 'pending').
 *   p_admin_override  - Passed through to planner (allows expired mandatory).
 *   p_override_reason - Free-text reason when override is used (for audit).
 *   p_reallocate      - If TRUE, clears existing allocations for this lesson
 *                       and recomputes; if FALSE, fails if allocations exist.
 *
 * Behaviour (high level):
 *
 *   0. Admin override auth
 *      - If p_admin_override = TRUE:
 *          * Checks current_setting('request.jwt.claim.role') = 'admin'.
 *          * Raises if caller is not admin.
 *
 *   1. Idempotency per lesson
 *      - If allocations already exist for this lesson:
 *          * If p_reallocate = FALSE:
 *                raise error: "Allocations already exist..."
 *          * Else:
 *                DELETE FROM allocations WHERE lesson_id = p_lesson_id;
 *                log a JSON step { "reallocate_cleared": true }.
 *
 *   2. Ask planner for the allocation plan (NO writes in planner)
 *      - v_plan := fn_plan_lesson_allocation(p_lesson_id, p_admin_override).
 *      - Extracts:
 *          isSnc      := (v_plan->>'isSnc')::boolean
 *          isFreeSnc  := (v_plan->>'isFreeSnc')::boolean
 *          sncMode    := v_plan->>'sncMode'
 *          tier       := nullif(v_plan->>'tier','')::public.tier
 *          studentId  := (v_plan->>'studentId')::uuid
 *
 *   3. FREE SNC path
 *      - If isSnc AND isFreeSnc:
 *          * UPDATE lessons
 *              SET state    = 'confirmed',
 *                  snc_mode = 'free'
 *            WHERE id = p_lesson_id;
 *          * Append a step:
 *              { "snc":true, "tier":..., "free_snc":true, "allocations":"skipped" }
 *          * RETURN v_plan || {
 *                lesson_id : p_lesson_id,
 *                steps     : v_steps,
 *                override  : p_admin_override,
 *                reason    : p_override_reason
 *            };
 *          * No allocations are written for free SNCs.
 *
 *   4. Apply planned allocations (normal lesson or paid SNC)
 *      - Loops over each element in v_plan->'plan':
 *
 *        a) Overdraft step (overdraft = true)
 *           - Obtain / create overdraft lot:
 *               v_overdraft_lot := get_or_create_overdraft_lot(studentId).
 *           - INSERT INTO allocations (lesson_id, credit_lot_id, minutes_allocated)
 *               VALUES (p_lesson_id, v_overdraft_lot, allocate).
 *           - Log a JSON step:
 *               { credit_lot_id: v_overdraft_lot, allocate: <min>, overdraft:true }.
 *
 *        b) Normal allocation step (overdraft = false)
 *           - If allocate > 0:
 *               INSERT INTO allocations (lesson_id, credit_lot_id, minutes_allocated)
 *                 VALUES (p_lesson_id, creditLotId, allocate).
 *               Log a JSON step:
 *                 { credit_lot_id: creditLotId, allocate: <min> }.
 *
 *      - NOTE: rpc_confirm_lesson does NOT re-run any allocation logic.
 *              It just trusts the plan from fn_plan_lesson_allocation and
 *              materialises it as rows in allocations.
 *
 *   5. Commit lesson state
 *      - UPDATE lessons
 *          SET state    = 'confirmed',
 *              snc_mode = CASE sncMode
 *                           WHEN 'free'    THEN 'free'
 *                           WHEN 'charged' THEN 'charged'
 *                           ELSE 'none'
 *                         END
 *        WHERE id = p_lesson_id;
 *
 *   6. Return JSON summary
 *      - Returns:
 *          v_plan || {
 *            lesson_id : p_lesson_id,
 *            steps     : v_steps,          -- includes reallocate/overdraft notes
 *            override  : p_admin_override,
 *            reason    : p_override_reason
 *          }
 *      - This JSON is used by /api/admin/lessons/confirm and the Review page
 *        for logging/diagnostics; the authoritative state is in DB tables:
 *        lessons, allocations, credit_lots, hazard views.
 *
 * Notes:
 *   - fn_plan_lesson_allocation is the only place that decides *which* lots
 *     are used, in what order, and whether overdraft is needed.
 *   - rpc_confirm_lesson is responsible only for:
 *       * idempotency / reallocation control,
 *       * writing allocations (including overdraft lot),
 *       * updating lesson.state and lesson.snc_mode,
 *       * packaging planner output + audit steps.
 * ========================================================================== */

DECLARE
  v_actor  uuid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  v_role   text := current_setting('request.jwt.claim.role', true);

  v_plan        jsonb;
  v_is_snc      boolean;
  v_is_free_snc boolean;
  v_snc_mode    text;
  v_tier        public.tier;
  v_student     uuid;

  v_steps jsonb := '[]'::jsonb;
  v_step  jsonb;

  v_overdraft_lot uuid;
BEGIN
  --------------------------------------------------------------------
  -- 0) Admin override auth (same rule as before)
  --------------------------------------------------------------------
  IF p_admin_override THEN
    IF coalesce(v_role, '') <> 'admin' THEN
      RAISE EXCEPTION 'Admin override not permitted for this user';
    END IF;
  END IF;

  --------------------------------------------------------------------
  -- 1) Idempotency per lesson (optional reallocation)
  --------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM public.allocations WHERE lesson_id = p_lesson_id) THEN
    IF NOT p_reallocate THEN
      RAISE EXCEPTION
        'Allocations already exist for lesson % (set p_reallocate=true to recompute)',
        p_lesson_id;
    END IF;

    DELETE FROM public.allocations WHERE lesson_id = p_lesson_id;

    v_steps := v_steps || jsonb_build_array(
      jsonb_build_object('reallocate_cleared', TRUE)
    );
  END IF;

  --------------------------------------------------------------------
  -- 2) Ask the planner what should happen (NO writes here)
  --------------------------------------------------------------------
  v_plan := public.fn_plan_lesson_allocation(p_lesson_id, p_admin_override);

  v_is_snc      := (v_plan->>'isSnc')::boolean;
  v_is_free_snc := (v_plan->>'isFreeSnc')::boolean;
  v_snc_mode    := v_plan->>'sncMode';
  v_tier        := nullif(v_plan->>'tier', '')::public.tier;
  v_student     := (v_plan->>'studentId')::uuid;

  --------------------------------------------------------------------
  -- 3) If FREE SNC: confirm without allocations (planner decided this)
  --------------------------------------------------------------------
  IF v_is_snc AND v_is_free_snc THEN
    UPDATE public.lessons
    SET state    = 'confirmed',
        snc_mode = 'free'::public.snc_mode
    WHERE id = p_lesson_id;

    v_steps := v_steps || jsonb_build_array(
      jsonb_build_object(
        'snc',        TRUE,
        'tier',       coalesce(v_tier::text, 'null'),
        'free_snc',   TRUE,
        'allocations','skipped'
      )
    );

    RETURN v_plan || jsonb_build_object(
      'lesson_id', p_lesson_id,
      'steps',     v_steps,
      'override',  p_admin_override,
      'reason',    p_override_reason
    );
  END IF;

  --------------------------------------------------------------------
  -- 4) Apply the planned allocations (including overdraft step)
  --------------------------------------------------------------------
  FOR v_step IN
    SELECT jsonb_array_elements(v_plan->'plan')
  LOOP
    -- Overdraft step: creditLotId is NULL, overdraft = true
    IF (v_step->>'overdraft')::boolean IS TRUE THEN
      v_overdraft_lot := public.get_or_create_overdraft_lot(v_student);

      INSERT INTO public.allocations (lesson_id, credit_lot_id, minutes_allocated)
      VALUES (
        p_lesson_id,
        v_overdraft_lot,
        (v_step->>'allocate')::int
      );

      v_steps := v_steps || jsonb_build_array(
        jsonb_build_object(
          'credit_lot_id', v_overdraft_lot,
          'allocate',      (v_step->>'allocate')::int,
          'overdraft',     TRUE
        )
      );

    ELSE
      -- Normal allocation step
      IF (v_step->>'allocate')::int > 0 THEN
        INSERT INTO public.allocations (lesson_id, credit_lot_id, minutes_allocated)
        VALUES (
          p_lesson_id,
          (v_step->>'creditLotId')::uuid,
          (v_step->>'allocate')::int
        );

        v_steps := v_steps || jsonb_build_array(
          jsonb_build_object(
            'credit_lot_id', (v_step->>'creditLotId')::uuid,
            'allocate',      (v_step->>'allocate')::int
          )
        );
      END IF;
    END IF;
  END LOOP;

  --------------------------------------------------------------------
  -- 5) Commit lesson state (non-free SNC or normal lesson)
  --------------------------------------------------------------------
  UPDATE public.lessons
  SET state    = 'confirmed',
      snc_mode = CASE v_snc_mode
                   WHEN 'free'    THEN 'free'::public.snc_mode
                   WHEN 'charged' THEN 'charged'::public.snc_mode
                   ELSE 'none'::public.snc_mode
                 END
  WHERE id = p_lesson_id;

  --------------------------------------------------------------------
  -- 6) Return planner JSON + steps + override metadata
  --------------------------------------------------------------------
  RETURN v_plan || jsonb_build_object(
    'lesson_id', p_lesson_id,
    'steps',     v_steps,
    'override',  p_admin_override,
    'reason',    p_override_reason
  );
END;$$;


ALTER FUNCTION "public"."rpc_confirm_lesson"("p_lesson_id" "uuid", "p_admin_override" boolean, "p_override_reason" "text", "p_reallocate" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_decline_lesson"("p_lesson_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_state  public.lesson_state;
  v_is_snc boolean;
  v_actor  uuid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  v_role   text := current_setting('request.jwt.claim.role', true);
begin
  --------------------------------------------------------------------
  -- 0) Authorisation
  --    • If a JWT role is present, it must be 'admin' or 'service_role'
  --    • If no role claim (service key / internal), we allow it
  --------------------------------------------------------------------
  if v_role is not null
     and v_role not in ('admin', 'service_role') then
    raise exception 'Only admins may decline lessons';
  end if;

  --------------------------------------------------------------------
  -- 1) Load & lock lesson
  --------------------------------------------------------------------
  select state, is_snc
    into v_state, v_is_snc
  from public.lessons
  where id = p_lesson_id
  for update;

  if not found then
    raise exception 'Lesson % not found', p_lesson_id using errcode = 'P0002';
  end if;

  if v_state <> 'pending' then
    raise exception 'Lesson % is not pending (state=%)', p_lesson_id, v_state;
  end if;

  --------------------------------------------------------------------
  -- 2) Defensive cleanup: remove any allocations if they exist
  --    (In theory there shouldn't be any for a pending lesson.)
  --------------------------------------------------------------------
  delete from public.allocations
  where lesson_id = p_lesson_id;

  --------------------------------------------------------------------
  -- 3) Mark lesson as declined
  --------------------------------------------------------------------
  update public.lessons
     set state = 'declined'
   where id = p_lesson_id;

  --------------------------------------------------------------------
  -- 4) Optional future audit hook
  --------------------------------------------------------------------
  return jsonb_build_object(
    'lesson_id', p_lesson_id,
    'state',     'declined',
    'is_snc',    v_is_snc,
    'reason',    p_reason
  );
end;
$$;


ALTER FUNCTION "public"."rpc_decline_lesson"("p_lesson_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_import_invoice"("p_student_id" "uuid", "p_external_ref" "text", "p_minutes_granted" integer, "p_start_date" "date", "p_delivery_restriction" "text", "p_tier_restriction" "text", "p_length_restriction" "text", "p_expiry_policy" "text", "p_expiry_date" "date", "p_lessons_per_month" integer, "p_duration_per_lesson_mins" integer, "p_buffer" numeric, "p_amount_pennies" integer) RETURNS "public"."credit_lots"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_row            public.credit_lots%rowtype;
  v_expiry         date;
  v_months_final   integer;
  v_buf            numeric;
  v_extref         text;               -- raw, trimmed
  v_extref_norm    text;               -- uppercase-trim
  v_delivery       public.delivery;    -- enum cast targets
  v_tier           public.tier;
  v_length         public.length_cat;      -- enum cast target for length_restriction
  v_expiry_policy  public.expiry_policy;   -- enum cast target for expiry_policy
  v_actor          uuid;
BEGIN
  -- Normalise inputs
  v_extref      := btrim(p_external_ref);
  v_extref_norm := upper(v_extref);
  v_actor       := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;

  -- ─────────────────────────────────────────────────────────────
  -- Validation
  -- ─────────────────────────────────────────────────────────────
  IF p_student_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'student_id is required';
  END IF;

  IF coalesce(v_extref, '') = '' THEN
    RAISE EXCEPTION USING MESSAGE = 'external_ref is required (e.g., Xero invoice number)';
  END IF;

  IF p_minutes_granted IS NULL OR p_minutes_granted <= 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'minutes_granted must be a positive integer';
  END IF;

  IF p_start_date IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'start_date is required';
  END IF;

  IF p_delivery_restriction IS NOT NULL
     AND p_delivery_restriction NOT IN ('online','f2f') THEN
    RAISE EXCEPTION USING MESSAGE = 'delivery_restriction must be online or f2f';
  END IF;

  IF p_tier_restriction IS NOT NULL
     AND p_tier_restriction NOT IN ('basic','premium','elite') THEN
    RAISE EXCEPTION USING MESSAGE = 'tier_restriction must be basic, premium, or elite';
  END IF;

  IF p_length_restriction IS NOT NULL
     AND p_length_restriction NOT IN ('60','90','120','none') THEN
    RAISE EXCEPTION USING MESSAGE = 'length_restriction must be 60, 90, 120, or none';
  END IF;

  IF p_expiry_policy IS NULL
     OR p_expiry_policy NOT IN ('none','mandatory','advisory') THEN
    RAISE EXCEPTION USING MESSAGE = 'expiry_policy must be none, mandatory, or advisory';
  END IF;

  IF p_amount_pennies IS NULL OR p_amount_pennies <= 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'amount_pennies must be a positive integer (pennies)';
  END IF;

  -- ─────────────────────────────────────────────────────────────
  -- Cast enums
  -- ─────────────────────────────────────────────────────────────
  v_delivery := CASE
                  WHEN p_delivery_restriction IS NULL THEN NULL
                  ELSE p_delivery_restriction::public.delivery
                END;

  v_tier := CASE
              WHEN p_tier_restriction IS NULL THEN NULL
              ELSE p_tier_restriction::public.tier
            END;

  v_length := CASE
                WHEN p_length_restriction IS NULL THEN NULL
                ELSE p_length_restriction::public.length_cat
              END;

  v_expiry_policy := p_expiry_policy::public.expiry_policy;

  -- ─────────────────────────────────────────────────────────────
  -- Expiry calculation (consistent with credit_lots_expiry_guard)
  -- ─────────────────────────────────────────────────────────────
  v_buf := coalesce(p_buffer, 0.5);

  IF p_expiry_policy = 'none' THEN
    -- => No expiry date at all
    v_expiry := NULL;

  ELSE
    -- 'advisory' or 'mandatory'
    IF p_expiry_date IS NOT NULL THEN
      -- explicit override from UI
      v_expiry := p_expiry_date;

    ELSIF p_lessons_per_month IS NOT NULL
          AND p_duration_per_lesson_mins IS NOT NULL
          AND p_lessons_per_month > 0
          AND p_duration_per_lesson_mins > 0 THEN

      v_months_final :=
        ceil(
          (p_minutes_granted::numeric / p_duration_per_lesson_mins::numeric)
          / p_lessons_per_month::numeric
          * (1 + v_buf)
        )::int;

      IF v_months_final < 1 THEN
        v_months_final := 1;
      END IF;

      v_expiry := (p_start_date + make_interval(months => v_months_final))::date;

    ELSE
      -- Fallback: 12-month expiry
      v_expiry := (p_start_date + interval '12 months')::date;
    END IF;
  END IF;

  IF v_expiry IS NOT NULL AND v_expiry < p_start_date THEN
    RAISE EXCEPTION USING MESSAGE = 'expiry_date cannot be before start_date';
  END IF;

  -- ─────────────────────────────────────────────────────────────
  -- Insert invoice lot (idempotent on student+source+external_ref_norm)
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO public.credit_lots (
    id,
    student_id,
    source_type,
    award_reason_code,
    external_ref,
    minutes_granted,
    delivery_restriction,
    tier_restriction,
    length_restriction,
    start_date,
    expiry_policy,
    expiry_date,
    state,
    created_at,
    amount_pennies
  )
  VALUES (
    gen_random_uuid(),
    p_student_id,
    'invoice',
    NULL,
    v_extref,
    p_minutes_granted,
    v_delivery,
    v_tier,
    v_length,
    p_start_date,
    v_expiry_policy,
    v_expiry,
    'open',
    now(),
    p_amount_pennies
  )
  ON CONFLICT ON CONSTRAINT uq_credit_lots_student_source_extrefnorm
  DO NOTHING
  RETURNING * INTO v_row;

  -- Duplicate invoice: show as an ERROR, not success
  IF v_row.id IS NULL THEN
    -- Optionally fetch existing row just for context (not strictly needed)
    SELECT *
      INTO v_row
    FROM public.credit_lots
    WHERE student_id = p_student_id
      AND source_type = 'invoice'
      AND external_ref_norm = v_extref_norm;

    RAISE EXCEPTION USING
      MESSAGE = 'Invoice already exists for this student; no new credit added.',
      DETAIL  = format('student_id=%s, external_ref=%s', p_student_id::text, v_extref);
  END IF;

  -- ─────────────────────────────────────────────────────────────
  -- Audit creation of new lot
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO public.credit_lot_events (credit_lot_id, event_type, actor_id, details)
  VALUES (
    v_row.id,
    'created',
    v_actor,
    jsonb_build_object(
      'external_ref', v_extref,
      'external_ref_norm', v_extref_norm,
      'minutes_granted', p_minutes_granted,
      'start_date', p_start_date,
      'expiry_policy', p_expiry_policy,
      'expiry_date', v_expiry,
      'delivery_restriction', p_delivery_restriction,
      'tier_restriction', p_tier_restriction,
      'length_restriction', p_length_restriction,
      'lessons_per_month', p_lessons_per_month,
      'duration_per_lesson_mins', p_duration_per_lesson_mins,
      'buffer', v_buf,
      'amount_pennies', p_amount_pennies
    )
  );

  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."rpc_import_invoice"("p_student_id" "uuid", "p_external_ref" "text", "p_minutes_granted" integer, "p_start_date" "date", "p_delivery_restriction" "text", "p_tier_restriction" "text", "p_length_restriction" "text", "p_expiry_policy" "text", "p_expiry_date" "date", "p_lessons_per_month" integer, "p_duration_per_lesson_mins" integer, "p_buffer" numeric, "p_amount_pennies" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_invoice_overdraft"("p_student_id" "uuid", "p_invoice_ref" "text", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."rpc_invoice_overdraft"("p_student_id" "uuid", "p_invoice_ref" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_log_lesson"("p_student_id" "uuid", "p_occurred_at" timestamp with time zone, "p_duration_min" integer, "p_delivery" "public"."delivery", "p_is_snc" boolean DEFAULT false, "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_teacher_id uuid;
  v_lesson_id  uuid;

  v_min_duration_regular constant integer := 10;
begin
  select t.id
    into v_teacher_id
  from public.teachers t
  where t.profile_id = auth.uid();

  if v_teacher_id is null then
    raise exception 'No teacher record found for current user';
  end if;

  if p_duration_min is null or p_duration_min <= 0 then
    raise exception 'Duration must be greater than 0 minutes';
  end if;

  if coalesce(p_is_snc, false) = false
     and p_duration_min < v_min_duration_regular then
    raise exception
      using message = format(
        'Duration must be at least %s minutes',
        v_min_duration_regular
      );
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

  insert into public.lessons (
    student_id,
    teacher_id,
    occurred_at,
    duration_min,
    delivery,
    length_cat,
    state,
    is_snc,
    snc_mode,
    notes,
    created_by
  )
  values (
    p_student_id,
    v_teacher_id,
    p_occurred_at,
    p_duration_min,
    p_delivery,
    'none',
    'pending',
    coalesce(p_is_snc, false),
    'none',
    p_notes,
    auth.uid()
  )
  returning id into v_lesson_id;

  return jsonb_build_object(
    'lesson_id',  v_lesson_id,
    'student_id', p_student_id,
    'teacher_id', v_teacher_id,
    'is_snc',     coalesce(p_is_snc, false)
  );
end;
$$;


ALTER FUNCTION "public"."rpc_log_lesson"("p_student_id" "uuid", "p_occurred_at" timestamp with time zone, "p_duration_min" integer, "p_delivery" "public"."delivery", "p_is_snc" boolean, "p_notes" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teacher_expenses" (
    "id" bigint NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "incurred_at" timestamp with time zone NOT NULL,
    "amount_pennies" integer NOT NULL,
    "status" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category" "text" DEFAULT 'other'::"text" NOT NULL,
    "student_id" "uuid",
    CONSTRAINT "teacher_expenses_category_check" CHECK (("category" = ANY (ARRAY['drinks'::"text", 'teaching_resources'::"text", 'other'::"text"]))),
    CONSTRAINT "teacher_expenses_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."teacher_expenses" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_log_teacher_expense"("p_incurred_at" timestamp with time zone, "p_amount_pennies" integer, "p_category" "text", "p_description" "text", "p_student_id" "uuid") RETURNS "public"."teacher_expenses"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."rpc_log_teacher_expense"("p_incurred_at" timestamp with time zone, "p_amount_pennies" integer, "p_category" "text", "p_description" "text", "p_student_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_mark_students_dormant"("p_inactive_interval" interval DEFAULT '3 mons'::interval) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- Delegate to the canonical implementation which:
  --  - uses v_student_last_activity
  --  - checks remaining >= 0 via v_credit_lot_remaining
  --  - writes student_status_events
  return public.rpc_auto_dormant_students(p_inactive_interval);
end;
$$;


ALTER FUNCTION "public"."rpc_mark_students_dormant"("p_inactive_interval" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_preview_lesson_allocation"("p_lesson_id" "uuid", "p_admin_override" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$/* ============================================================================
 * rpc_preview_lesson_allocation
 * ---------------------------------------------------------------------------
 * Signature:
 *   rpc_preview_lesson_allocation(
 *     p_lesson_id      uuid,
 *     p_admin_override boolean
 *   ) RETURNS jsonb
 *
 * Purpose:
 *   Read-only facade for the planner.
 *   Returns the JSON allocation plan for a pending lesson by delegating
 *   directly to fn_plan_lesson_allocation, with NO writes.
 *
 * Behaviour:
 *   - Does NOT touch lessons, allocations, credit_lots or any other tables.
 *   - Simply calls:
 *       RETURN fn_plan_lesson_allocation(p_lesson_id, p_admin_override);
 *   - All validation, SNC policy, FIFO ordering, hazard flags and overdraft
 *     planning are handled inside fn_plan_lesson_allocation.
 *
 * Usage:
 *   - Used by /api/admin/lessons/preview (POST) which the Admin “Review lesson”
 *     page calls to render:
 *       • Allocation preview table (per-lot steps).
 *       • Preview hazard badges:
 *           counterDelivery, lengthViolation, negativeBalance.
 *   - The confirm path (/api/admin/lessons/confirm → rpc_confirm_lesson)
 *     uses the same planner, so preview and confirm share one SQL “brain”.
 *
 * Important:
 *   - Keep this function STRICTLY read-only. Do not add any INSERT/UPDATE/DELETE
 *     logic here; all side-effects belong in rpc_confirm_lesson.
 *   - If allocation rules change, update fn_plan_lesson_allocation only.
 * ========================================================================== */

BEGIN
  -- Thin wrapper: just delegate to the planner
  RETURN public.fn_plan_lesson_allocation(p_lesson_id, p_admin_override);
END;$$;


ALTER FUNCTION "public"."rpc_preview_lesson_allocation"("p_lesson_id" "uuid", "p_admin_override" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_refresh_teacher_statuses"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r record;
  v_old teacher_status;
  v_new teacher_status;
begin
  for r in
    select
      t.id as teacher_id,
      t.status as old_status,
      case
        when t.status = 'past' then 'past'::teacher_status  -- manual override, never auto-changed
        when exists (
          select 1
          from student_teacher st
          join students s on s.id = st.student_id
          where st.teacher_id = t.id
            and s.status = 'current'
        ) then 'current'::teacher_status
        when exists (
          select 1
          from student_teacher st
          join students s on s.id = st.student_id
          where st.teacher_id = t.id
            and s.status = 'dormant'
        ) then 'inactive'::teacher_status
        else 'potential'::teacher_status
      end as new_status
    from teachers t
  loop
    v_old := r.old_status;
    v_new := r.new_status;

    -- Only act when the derived status differs
    if v_old is distinct from v_new then
      update teachers
      set status = v_new
      where id = r.teacher_id;

      -- Log the change as an auto event
      insert into teacher_status_events (
        teacher_id,
        old_status,
        new_status,
        is_auto
      )
      values (
        r.teacher_id,
        v_old,
        v_new,
        true
      );
    end if;
  end loop;
end;
$$;


ALTER FUNCTION "public"."rpc_refresh_teacher_statuses"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_resolve_hazard"("p_hazard_type" "text", "p_lesson_id" "uuid" DEFAULT NULL::"uuid", "p_allocation_id" "uuid" DEFAULT NULL::"uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor       uuid := nullif(current_setting('request.jwt.claim.sub',  true), '')::uuid;
  v_role        text :=        current_setting('request.jwt.claim.role', true);
  v_existing_id uuid;
  v_now         timestamptz := now();
BEGIN
  --------------------------------------------------------------------
  -- 0) Auth:
  --    - If a JWT role is present, only 'admin' may call this.
  --    - If there is NO JWT (service-role / server-side), allow.
  --------------------------------------------------------------------
  IF v_role IS NOT NULL AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'rpc_resolve_hazard: admin role required'
      USING errcode = '42501';
  END IF;

  --------------------------------------------------------------------
  -- 1) Validate: exactly one of lesson_id / allocation_id must be set
  --    (mirrors hazard_resolutions_one_target check)
  --------------------------------------------------------------------
  IF (p_lesson_id IS NULL AND p_allocation_id IS NULL)
     OR (p_lesson_id IS NOT NULL AND p_allocation_id IS NOT NULL) THEN
    RAISE EXCEPTION
      'rpc_resolve_hazard: exactly one of p_lesson_id or p_allocation_id must be non-null';
  END IF;

  --------------------------------------------------------------------
  -- 2) Idempotency: has this hazard already been resolved?
  --------------------------------------------------------------------
  SELECT id
    INTO v_existing_id
  FROM public.hazard_resolutions
  WHERE hazard_type = p_hazard_type
    AND (
      (p_lesson_id    IS NOT NULL AND lesson_id    = p_lesson_id)
      OR
      (p_allocation_id IS NOT NULL AND allocation_id = p_allocation_id)
    )
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'resolved',         false,
      'already_resolved', true,
      'hazard_type',      p_hazard_type,
      'lesson_id',        p_lesson_id,
      'allocation_id',    p_allocation_id
    );
  END IF;

  --------------------------------------------------------------------
  -- 3) Insert resolution row
  --------------------------------------------------------------------
  INSERT INTO public.hazard_resolutions (
    lesson_id,
    allocation_id,
    hazard_type,
    resolved_by,
    resolved_at,
    note
  )
  VALUES (
    CASE WHEN p_allocation_id IS NULL THEN p_lesson_id     ELSE NULL END,
    CASE WHEN p_allocation_id IS NOT NULL THEN p_allocation_id ELSE NULL END,
    p_hazard_type,
    v_actor,
    v_now,
    p_note
  )
  RETURNING id INTO v_existing_id;

  --------------------------------------------------------------------
  -- 4) Return JSON summary
  --------------------------------------------------------------------
  RETURN jsonb_build_object(
    'resolved',         true,
    'already_resolved', false,
    'id',               v_existing_id,
    'hazard_type',      p_hazard_type,
    'lesson_id',        p_lesson_id,
    'allocation_id',    p_allocation_id,
    'note',             p_note,
    'resolved_at',      v_now,
    'resolved_by',      v_actor
  );
END;
$$;


ALTER FUNCTION "public"."rpc_resolve_hazard"("p_hazard_type" "text", "p_lesson_id" "uuid", "p_allocation_id" "uuid", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_update_invoice_lot_minutes"("p_credit_lot_id" "uuid", "p_new_minutes_granted" integer) RETURNS "public"."credit_lots"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_row_before public.credit_lots%rowtype;
  v_row_after  public.credit_lots%rowtype;
  v_actor      uuid;
BEGIN
  IF p_credit_lot_id IS NULL THEN RAISE EXCEPTION 'credit_lot_id is required'; END IF;
  IF p_new_minutes_granted IS NULL OR p_new_minutes_granted <= 0 THEN
    RAISE EXCEPTION 'p_new_minutes_granted must be positive';
  END IF;

  v_actor := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;

  SELECT * INTO v_row_before FROM public.credit_lots WHERE id = p_credit_lot_id AND source_type = 'invoice';
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice lot not found'; END IF;

  UPDATE public.credit_lots
  SET minutes_granted = p_new_minutes_granted
  WHERE id = p_credit_lot_id
  RETURNING * INTO v_row_after;

  INSERT INTO public.credit_lot_events(credit_lot_id, event_type, actor_id, details)
  VALUES (
    p_credit_lot_id,
    'amend_applied',
    v_actor,
    jsonb_build_object(
      'field', 'minutes_granted',
      'before', v_row_before.minutes_granted,
      'after', v_row_after.minutes_granted
    )
  );

  RETURN v_row_after;
END;
$$;


ALTER FUNCTION "public"."rpc_update_invoice_lot_minutes"("p_credit_lot_id" "uuid", "p_new_minutes_granted" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_write_off_overdraft"("p_student_id" "uuid", "p_reason_code" "text", "p_note" "text" DEFAULT NULL::"text", "p_accounting_period" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."rpc_write_off_overdraft"("p_student_id" "uuid", "p_reason_code" "text", "p_note" "text", "p_accounting_period" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_write_off_overdraft_credit"("p_student_id" "uuid", "p_reason_code" "public"."credit_write_off_reason" DEFAULT 'overdraft_write_off'::"public"."credit_write_off_reason", "p_note" "text" DEFAULT NULL::"text", "p_accounting_period" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
begin
  return public.fn_write_off_overdraft_common(
    p_student_id        => p_student_id,
    p_reason_code       => p_reason_code,
    p_note              => p_note,
    p_accounting_period => p_accounting_period
  );
end;
$$;


ALTER FUNCTION "public"."rpc_write_off_overdraft_credit"("p_student_id" "uuid", "p_reason_code" "public"."credit_write_off_reason", "p_note" "text", "p_accounting_period" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_write_off_remaining_credit"("p_student_id" "uuid", "p_reason_code" "public"."credit_write_off_reason" DEFAULT 'manual_write_off'::"public"."credit_write_off_reason", "p_note" "text" DEFAULT NULL::"text", "p_accounting_period" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_remaining integer;
  v_to_remove integer;
  v_now timestamptz := now();
  v_actor uuid;
  v_period text;
  v_direction public.credit_write_off_direction;
  v_lot record;
  v_lot_remaining integer;
begin
  -- Basic validation
  if p_student_id is null then
    raise exception using message = 'student_id is required';
  end if;

  -- Who is doing this? (optional)
  v_actor := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;

  -- Total remaining minutes from your canonical view
  select coalesce(sum(minutes_remaining), 0)
    into v_remaining
  from public.v_credit_lot_remaining
  where student_id = p_student_id;

  -- Only handle positive remaining credit in this v1
  if v_remaining <= 0 then
    raise exception using message = 'No positive remaining credit to write off';
  end if;

  v_direction := 'positive';
  v_to_remove := v_remaining;
  v_period := coalesce(p_accounting_period, to_char(v_now::date, 'YYYY'));

  -- Reduce unallocated portions of invoice/award lots in FIFO order
  for v_lot in
    select cl.id,
           cl.minutes_granted,
           cl.minutes_allocated
      from public.credit_lots cl
     where cl.student_id = p_student_id
       and cl.source_type in ('invoice', 'award')  -- don't touch overdraft here
       and cl.state = 'open'
     order by cl.start_date asc, cl.created_at asc
  loop
    exit when v_to_remove <= 0;

    -- Remaining leeway on this lot
    v_lot_remaining := greatest(v_lot.minutes_granted - v_lot.minutes_allocated, 0);

    if v_lot_remaining <= 0 then
      continue;
    end if;

    if v_lot_remaining <= v_to_remove then
      -- We can wipe all remaining on this lot
      update public.credit_lots
         set minutes_granted = v_lot.minutes_allocated
       where id = v_lot.id;

      v_to_remove := v_to_remove - v_lot_remaining;
    else
      -- Only partially reduce this lot
      update public.credit_lots
         set minutes_granted = minutes_granted - v_to_remove
       where id = v_lot.id;

      v_to_remove := 0;
    end if;

    -- Optional: if you have a suitable event_type in credit_lot_events,
    -- you can log an adjustment event here.
    -- insert into public.credit_lot_events(credit_lot_id, event_type, actor_id, details)
    -- values (
    --   v_lot.id,
    --   'write_off_adjustment',    -- adjust to your existing enum values
    --   v_actor,
    --   jsonb_build_object(
    --     'minutes_written_off', v_lot_remaining,
    --     'reason_code', p_reason_code
    --   )
    -- );
  end loop;

  -- Sanity: we expect to have removed everything we planned
  if v_to_remove <> 0 then
    -- This should not normally happen if v_credit_lot_remaining lines up with credit_lots
    raise exception using message = 'Write-off mismatch: not all remaining credit could be removed';
  end if;

  -- Insert ledger row for accountant
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
    null, -- no single lot; this is a global write-off for the student
    v_direction,
    v_remaining,
    p_reason_code,
    p_note,
    v_period,
    v_now,
    v_actor
  );

  -- Mark student as past
  update public.students
     set status = 'past'
   where id = p_student_id;

  return jsonb_build_object(
    'ok', true,
    'direction', v_direction,
    'minutes_written_off', v_remaining,
    'accounting_period', v_period
  );
end;
$$;


ALTER FUNCTION "public"."rpc_write_off_remaining_credit"("p_student_id" "uuid", "p_reason_code" "public"."credit_write_off_reason", "p_note" "text", "p_accounting_period" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_block_paid_teacher_expense_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."trg_block_paid_teacher_expense_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_prevent_delete_allocated_credit_lot"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."trg_prevent_delete_allocated_credit_lot"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lesson_id" "uuid" NOT NULL,
    "credit_lot_id" "uuid" NOT NULL,
    "minutes_allocated" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "allocations_minutes_allocated_check" CHECK (("minutes_allocated" > 0))
);


ALTER TABLE "public"."allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."award_reasons" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL
);


ALTER TABLE "public"."award_reasons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_lot_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "credit_lot_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "actor_id" "uuid",
    "details" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "credit_lot_events_type_check" CHECK (("event_type" = ANY (ARRAY['created'::"text", 'duplicate_detected'::"text", 'settle_overdraft'::"text", 'minutes_adjusted'::"text", 'lot_closed'::"text", 'lot_expired'::"text"])))
);


ALTER TABLE "public"."credit_lot_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_write_offs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "credit_lot_id" "uuid",
    "direction" "public"."credit_write_off_direction" NOT NULL,
    "minutes" integer NOT NULL,
    "reason_code" "public"."credit_write_off_reason" DEFAULT 'manual_write_off'::"public"."credit_write_off_reason" NOT NULL,
    "note" "text",
    "accounting_period" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "credit_write_offs_minutes_check" CHECK (("minutes" > 0))
);


ALTER TABLE "public"."credit_write_offs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hazard_resolutions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lesson_id" "uuid",
    "allocation_id" "uuid",
    "hazard_type" "public"."hazard_type" NOT NULL,
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "note" "text",
    CONSTRAINT "hazard_resolutions_one_target" CHECK (((("lesson_id" IS NOT NULL) AND ("allocation_id" IS NULL)) OR (("lesson_id" IS NULL) AND ("allocation_id" IS NOT NULL))))
);


ALTER TABLE "public"."hazard_resolutions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lessons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "duration_min" integer NOT NULL,
    "delivery" "public"."delivery" NOT NULL,
    "length_cat" "public"."length_cat" DEFAULT 'none'::"public"."length_cat" NOT NULL,
    "state" "public"."lesson_state" DEFAULT 'pending'::"public"."lesson_state" NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_snc" boolean DEFAULT false NOT NULL,
    "snc_mode" "public"."snc_mode" DEFAULT 'none'::"public"."snc_mode" NOT NULL,
    CONSTRAINT "lessons_duration_min_check" CHECK (("duration_min" > 0))
);


ALTER TABLE "public"."lessons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" DEFAULT ''::"text" NOT NULL,
    "role" "text" DEFAULT 'student'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "timezone" "text" DEFAULT 'Europe/London'::"text" NOT NULL,
    "preferred_name" "text",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['student'::"text", 'teacher'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_record_queries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "lesson_id" "uuid",
    "credit_lot_id" "uuid",
    "source" "text" DEFAULT 'student_portal'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "resolution_code" "text",
    "body" "text" NOT NULL,
    "admin_note" "text",
    "admin_profile_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "student_seen_at" timestamp with time zone,
    CONSTRAINT "student_record_queries_exactly_one_target" CHECK (((("lesson_id" IS NOT NULL) AND ("credit_lot_id" IS NULL)) OR (("lesson_id" IS NULL) AND ("credit_lot_id" IS NOT NULL))))
);


ALTER TABLE "public"."student_record_queries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_status_events" (
    "id" bigint NOT NULL,
    "student_id" "uuid" NOT NULL,
    "old_status" "public"."student_status" NOT NULL,
    "new_status" "public"."student_status" NOT NULL,
    "is_auto" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."student_status_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."student_status_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."student_status_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."student_status_events_id_seq" OWNED BY "public"."student_status_events"."id";



CREATE TABLE IF NOT EXISTS "public"."student_teacher" (
    "student_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."student_teacher" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tier" "public"."tier",
    "status" "public"."student_status" DEFAULT 'current'::"public"."student_status" NOT NULL
);


ALTER TABLE "public"."students" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."teacher_expenses_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."teacher_expenses_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."teacher_expenses_id_seq" OWNED BY "public"."teacher_expenses"."id";



CREATE TABLE IF NOT EXISTS "public"."teacher_invoices" (
    "id" bigint NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "month_start" "date" NOT NULL,
    "status" "text" NOT NULL,
    "invoice_ref" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "paid_at" timestamp with time zone,
    CONSTRAINT "teacher_invoices_status_check" CHECK (("status" = ANY (ARRAY['generated'::"text", 'paid'::"text"])))
);


ALTER TABLE "public"."teacher_invoices" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."teacher_invoices_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."teacher_invoices_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."teacher_invoices_id_seq" OWNED BY "public"."teacher_invoices"."id";



CREATE TABLE IF NOT EXISTS "public"."teacher_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "default_online_rate_pennies" integer NOT NULL,
    "f2f_basic_rate_pennies" integer NOT NULL,
    "f2f_premium_rate_pennies" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."teacher_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teacher_status_events" (
    "id" bigint NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "old_status" "public"."teacher_status" NOT NULL,
    "new_status" "public"."teacher_status" NOT NULL,
    "is_auto" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."teacher_status_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."teacher_status_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."teacher_status_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."teacher_status_events_id_seq" OWNED BY "public"."teacher_status_events"."id";



CREATE TABLE IF NOT EXISTS "public"."teacher_student_f2f_overrides" (
    "teacher_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "f2f_rate_pennies" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."teacher_student_f2f_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teachers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "public"."teacher_status" DEFAULT 'potential'::"public"."teacher_status" NOT NULL
);


ALTER TABLE "public"."teachers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."timezones" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL
);


ALTER TABLE "public"."timezones" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_allocation_delivery_hazards_raw" AS
 SELECT "a"."id" AS "allocation_id",
    "a"."lesson_id",
    "a"."credit_lot_id",
    "l"."delivery" AS "lesson_delivery",
    "cl"."delivery_restriction" AS "lot_delivery_restriction",
    ("public"."fn_delivery_hazard_type"("l"."delivery", "cl"."delivery_restriction"))::"public"."hazard_type" AS "hazard_type"
   FROM (("public"."allocations" "a"
     JOIN "public"."lessons" "l" ON (("l"."id" = "a"."lesson_id")))
     JOIN "public"."credit_lots" "cl" ON (("cl"."id" = "a"."credit_lot_id")))
  WHERE "public"."fn_is_delivery_mismatch"("l"."delivery", "cl"."delivery_restriction");


ALTER VIEW "public"."v_allocation_delivery_hazards_raw" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_allocation_delivery_hazards" AS
 SELECT "r"."allocation_id",
    "r"."lesson_id",
    "r"."credit_lot_id",
    "r"."lesson_delivery",
    "r"."lot_delivery_restriction",
    "r"."hazard_type"
   FROM ("public"."v_allocation_delivery_hazards_raw" "r"
     LEFT JOIN "public"."hazard_resolutions" "h" ON ((("h"."allocation_id" = "r"."allocation_id") AND ("h"."hazard_type" = "r"."hazard_type"))))
  WHERE ("h"."id" IS NULL);


ALTER VIEW "public"."v_allocation_delivery_hazards" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_allocation_length_restriction_hazards_raw" AS
 WITH "base" AS (
         SELECT "a"."id" AS "allocation_id",
            "a"."lesson_id",
            "a"."credit_lot_id",
            "l"."duration_min",
            "cl"."length_restriction",
            "public"."fn_length_threshold"("cl"."length_restriction") AS "threshold_min"
           FROM (("public"."allocations" "a"
             JOIN "public"."lessons" "l" ON (("l"."id" = "a"."lesson_id")))
             JOIN "public"."credit_lots" "cl" ON (("cl"."id" = "a"."credit_lot_id")))
        )
 SELECT "allocation_id",
    "lesson_id",
    "credit_lot_id",
    "duration_min",
    "length_restriction",
    "threshold_min",
    'length_restriction_mismatch'::"public"."hazard_type" AS "hazard_type"
   FROM "base"
  WHERE (("threshold_min" IS NOT NULL) AND ("duration_min" < "threshold_min"));


ALTER VIEW "public"."v_allocation_length_restriction_hazards_raw" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_allocation_length_restriction_hazards" AS
 SELECT "r"."allocation_id",
    "r"."lesson_id",
    "r"."credit_lot_id",
    "r"."hazard_type"
   FROM ("public"."v_allocation_length_restriction_hazards_raw" "r"
     LEFT JOIN "public"."hazard_resolutions" "h" ON ((("h"."allocation_id" = "r"."allocation_id") AND ("h"."hazard_type" = "r"."hazard_type"))))
  WHERE ("h"."id" IS NULL);


ALTER VIEW "public"."v_allocation_length_restriction_hazards" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_student_names" AS
 SELECT "s"."id" AS "student_id",
    "p"."full_name",
    COALESCE("p"."preferred_name", "p"."full_name") AS "display_name"
   FROM ("public"."students" "s"
     JOIN "public"."profiles" "p" ON (("p"."id" = "s"."profile_id")));


ALTER VIEW "public"."v_student_names" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_credit_expiry_by_month" AS
 WITH "lot_usage" AS (
         SELECT "cl"."id" AS "credit_lot_id",
            "cl"."student_id",
            "cl"."source_type",
            "cl"."expiry_date",
            "cl"."expiry_policy",
            "cl"."length_restriction",
            "cl"."delivery_restriction",
            "cl"."tier_restriction",
            "cl"."minutes_granted",
            COALESCE("sum"("a"."minutes_allocated"), (0)::bigint) AS "minutes_used"
           FROM ("public"."credit_lots" "cl"
             LEFT JOIN "public"."allocations" "a" ON (("a"."credit_lot_id" = "cl"."id")))
          GROUP BY "cl"."id", "cl"."student_id", "cl"."source_type", "cl"."expiry_date", "cl"."expiry_policy", "cl"."length_restriction", "cl"."delivery_restriction", "cl"."tier_restriction", "cl"."minutes_granted"
        ), "with_names" AS (
         SELECT "lu"."credit_lot_id",
            "lu"."student_id",
            "lu"."source_type",
            "lu"."expiry_date",
            "lu"."expiry_policy",
            "lu"."length_restriction",
            "lu"."delivery_restriction",
            "lu"."tier_restriction",
            "lu"."minutes_granted",
            "lu"."minutes_used",
            "vn"."full_name" AS "student_name"
           FROM ("lot_usage" "lu"
             LEFT JOIN "public"."v_student_names" "vn" ON (("vn"."student_id" = "lu"."student_id")))
        )
 SELECT ("date_trunc"('month'::"text", ("expiry_date")::timestamp with time zone))::"date" AS "month_start",
    "student_id",
    "student_name",
    "source_type",
    "expiry_policy",
    "length_restriction",
    "delivery_restriction",
    "tier_restriction",
    "sum"("minutes_granted") AS "minutes_granted_total",
    "sum"("minutes_used") AS "minutes_used_total",
    "sum"(GREATEST(("minutes_granted" - "minutes_used"), (0)::bigint)) AS "minutes_expired_unused"
   FROM "with_names"
  WHERE (("expiry_date" IS NOT NULL) AND ("expiry_date" < CURRENT_DATE))
  GROUP BY (("date_trunc"('month'::"text", ("expiry_date")::timestamp with time zone))::"date"), "student_id", "student_name", "source_type", "expiry_policy", "length_restriction", "delivery_restriction", "tier_restriction";


ALTER VIEW "public"."v_credit_expiry_by_month" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_credit_lot_remaining" AS
 WITH "lot_allocations" AS (
         SELECT "a"."credit_lot_id",
            COALESCE("sum"("a"."minutes_allocated"), (0)::bigint) AS "minutes_allocated"
           FROM "public"."allocations" "a"
          GROUP BY "a"."credit_lot_id"
        ), "lot_with_usage" AS (
         SELECT "cl"."id" AS "credit_lot_id",
            "cl"."student_id",
            "cl"."source_type",
            "cl"."award_reason_code",
            "cl"."external_ref",
            "cl"."minutes_granted",
            (COALESCE("la"."minutes_allocated", (0)::bigint))::integer AS "minutes_allocated",
            (("cl"."minutes_granted" - COALESCE("la"."minutes_allocated", (0)::bigint)))::integer AS "minutes_remaining",
            (("cl"."minutes_granted" - COALESCE("la"."minutes_allocated", (0)::bigint)) < 0) AS "is_overdrawn",
            "cl"."delivery_restriction",
            "cl"."tier_restriction",
            "cl"."length_restriction",
            "cl"."start_date",
            "cl"."expiry_policy",
            "cl"."expiry_date",
            "cl"."state",
            "cl"."created_at"
           FROM ("public"."credit_lots" "cl"
             LEFT JOIN "lot_allocations" "la" ON (("la"."credit_lot_id" = "cl"."id")))
        )
 SELECT "credit_lot_id",
    "student_id",
    "source_type",
    "award_reason_code",
    "external_ref",
    "minutes_granted",
    "minutes_allocated",
    "minutes_remaining",
    "is_overdrawn",
    "delivery_restriction",
    "tier_restriction",
    "length_restriction",
    "start_date",
    "expiry_policy",
    "expiry_date",
        CASE
            WHEN ("expiry_date" IS NULL) THEN NULL::integer
            ELSE ("expiry_date" - CURRENT_DATE)
        END AS "days_to_expiry",
    (("expiry_date" IS NOT NULL) AND ("expiry_date" >= CURRENT_DATE) AND ("expiry_date" <= (CURRENT_DATE + 30))) AS "expiry_within_30d",
        CASE
            WHEN (("state" = 'open'::"public"."credit_lot_state") AND ("minutes_remaining" <= 0)) THEN 'closed'::"public"."credit_lot_state"
            ELSE "state"
        END AS "state",
    "created_at"
   FROM "lot_with_usage";


ALTER VIEW "public"."v_credit_lot_remaining" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_lesson_length_hazards_raw" AS
 SELECT "id" AS "lesson_id",
    "student_id",
    "teacher_id",
    "duration_min",
    "length_cat",
    "public"."fn_length_threshold"("length_cat") AS "threshold_min",
    'length_too_short'::"public"."hazard_type" AS "hazard_type"
   FROM "public"."lessons" "l"
  WHERE (("state" = 'confirmed'::"public"."lesson_state") AND "public"."fn_is_length_too_short"("length_cat", "duration_min"));


ALTER VIEW "public"."v_lesson_length_hazards_raw" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_lesson_length_hazards" AS
 SELECT "r"."lesson_id",
    "r"."student_id",
    "r"."teacher_id",
    "r"."duration_min",
    "r"."length_cat",
    "r"."threshold_min",
    "r"."hazard_type"
   FROM ("public"."v_lesson_length_hazards_raw" "r"
     LEFT JOIN "public"."hazard_resolutions" "h" ON ((("h"."lesson_id" = "r"."lesson_id") AND ("h"."hazard_type" = "r"."hazard_type"))))
  WHERE ("h"."id" IS NULL);


ALTER VIEW "public"."v_lesson_length_hazards" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_overdraft_allocation_hazards" AS
 SELECT "a"."lesson_id",
    "a"."id" AS "allocation_id",
    'overdraft_allocation'::"public"."hazard_type" AS "hazard_type"
   FROM (("public"."allocations" "a"
     JOIN "public"."credit_lots" "cl" ON (("cl"."id" = "a"."credit_lot_id")))
     LEFT JOIN "public"."hazard_resolutions" "h" ON ((("h"."allocation_id" = "a"."id") AND ("h"."hazard_type" = 'overdraft_allocation'::"public"."hazard_type"))))
  WHERE (("cl"."source_type" = 'overdraft'::"text") AND ("h"."id" IS NULL));


ALTER VIEW "public"."v_overdraft_allocation_hazards" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_snc_overuse_hazards_raw" AS
 WITH "monthly_snc" AS (
         SELECT "l_1"."student_id",
            ("date_trunc"('month'::"text", "l_1"."occurred_at"))::"date" AS "month_start",
            "count"(*) AS "snc_count"
           FROM "public"."lessons" "l_1"
          WHERE "public"."fn_is_snc_lesson"("l_1"."is_snc", "l_1"."state")
          GROUP BY "l_1"."student_id", ("date_trunc"('month'::"text", "l_1"."occurred_at"))
        ), "overuse" AS (
         SELECT "m"."student_id",
            "m"."month_start",
            "m"."snc_count"
           FROM "monthly_snc" "m"
          WHERE "public"."fn_is_snc_overuse"("m"."snc_count")
        )
 SELECT "l"."id" AS "lesson_id",
    "l"."student_id",
    "l"."teacher_id",
    "l"."occurred_at",
    "o"."month_start",
    "o"."snc_count",
    'snc_overuse'::"public"."hazard_type" AS "hazard_type"
   FROM ("public"."lessons" "l"
     JOIN "overuse" "o" ON ((("o"."student_id" = "l"."student_id") AND (("date_trunc"('month'::"text", "l"."occurred_at"))::"date" = "o"."month_start"))))
  WHERE "public"."fn_is_snc_lesson"("l"."is_snc", "l"."state");


ALTER VIEW "public"."v_snc_overuse_hazards_raw" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_snc_overuse_hazards" AS
 SELECT "r"."lesson_id",
    "r"."student_id",
    "r"."teacher_id",
    "r"."month_start",
    "r"."snc_count",
    "r"."hazard_type"
   FROM ("public"."v_snc_overuse_hazards_raw" "r"
     LEFT JOIN "public"."hazard_resolutions" "h" ON ((("h"."lesson_id" = "r"."lesson_id") AND ("h"."hazard_type" = "r"."hazard_type"))))
  WHERE ("h"."id" IS NULL);


ALTER VIEW "public"."v_snc_overuse_hazards" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_lesson_hazards" AS
 SELECT "r"."lesson_id",
    NULL::"uuid" AS "allocation_id",
    "r"."hazard_type",
        CASE
            WHEN ("r"."hazard_type" = 'length_too_short'::"public"."hazard_type") THEN 'amber'::"text"
            ELSE 'unknown'::"text"
        END AS "severity"
   FROM "public"."v_lesson_length_hazards" "r"
UNION ALL
 SELECT "r"."lesson_id",
    "r"."allocation_id",
    "r"."hazard_type",
        CASE
            WHEN ("r"."hazard_type" = 'delivery_f2f_on_online'::"public"."hazard_type") THEN 'red'::"text"
            WHEN ("r"."hazard_type" = 'delivery_online_on_f2f'::"public"."hazard_type") THEN 'yellow'::"text"
            ELSE 'unknown'::"text"
        END AS "severity"
   FROM "public"."v_allocation_delivery_hazards" "r"
UNION ALL
 SELECT "r"."lesson_id",
    "r"."allocation_id",
    "r"."hazard_type",
    'amber'::"text" AS "severity"
   FROM "public"."v_allocation_length_restriction_hazards" "r"
UNION ALL
 SELECT "r"."lesson_id",
    NULL::"uuid" AS "allocation_id",
    "r"."hazard_type",
    'yellow'::"text" AS "severity"
   FROM "public"."v_snc_overuse_hazards" "r"
UNION ALL
 SELECT "r"."lesson_id",
    "r"."allocation_id",
    "r"."hazard_type",
    'amber'::"text" AS "severity"
   FROM "public"."v_overdraft_allocation_hazards" "r";


ALTER VIEW "public"."v_lesson_hazards" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_lesson_revenue_detail" AS
 SELECT "a"."lesson_id",
    ("sum"("round"(((("a"."minutes_allocated")::numeric * ("cl"."amount_pennies")::numeric) / ("cl"."minutes_granted")::numeric))))::integer AS "revenue_pennies"
   FROM ("public"."allocations" "a"
     JOIN "public"."credit_lots" "cl" ON (("cl"."id" = "a"."credit_lot_id")))
  WHERE (("cl"."source_type" = 'invoice'::"text") AND ("cl"."amount_pennies" IS NOT NULL) AND ("cl"."minutes_granted" > 0))
  GROUP BY "a"."lesson_id";


ALTER VIEW "public"."v_lesson_revenue_detail" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_student_teacher_rate_summary" AS
 WITH "base" AS (
         SELECT "st"."student_id",
            "st"."teacher_id",
            "s"."tier" AS "student_tier",
            "tr"."default_online_rate_pennies",
            "tr"."f2f_basic_rate_pennies",
            "tr"."f2f_premium_rate_pennies",
            "o"."f2f_rate_pennies" AS "override_f2f_rate_pennies"
           FROM ((("public"."student_teacher" "st"
             JOIN "public"."students" "s" ON (("s"."id" = "st"."student_id")))
             LEFT JOIN "public"."teacher_rates" "tr" ON (("tr"."teacher_id" = "st"."teacher_id")))
             LEFT JOIN "public"."teacher_student_f2f_overrides" "o" ON ((("o"."teacher_id" = "st"."teacher_id") AND ("o"."student_id" = "st"."student_id"))))
        )
 SELECT "student_id",
    "teacher_id",
    "student_tier",
    "default_online_rate_pennies" AS "effective_online_rate_pennies",
        CASE
            WHEN ("override_f2f_rate_pennies" IS NOT NULL) THEN "override_f2f_rate_pennies"
            WHEN ("student_tier" = ANY (ARRAY['premium'::"public"."tier", 'elite'::"public"."tier"])) THEN "f2f_premium_rate_pennies"
            ELSE "f2f_basic_rate_pennies"
        END AS "effective_f2f_rate_pennies",
    ("override_f2f_rate_pennies" IS NOT NULL) AS "has_override",
        CASE
            WHEN ("override_f2f_rate_pennies" IS NOT NULL) THEN 'override'::"text"
            WHEN (("default_online_rate_pennies" IS NULL) AND ("f2f_basic_rate_pennies" IS NULL) AND ("f2f_premium_rate_pennies" IS NULL)) THEN 'no_rate'::"text"
            WHEN ("student_tier" = ANY (ARRAY['premium'::"public"."tier", 'elite'::"public"."tier"])) THEN 'tier_premium'::"text"
            ELSE 'tier_basic'::"text"
        END AS "f2f_source"
   FROM "base";


ALTER VIEW "public"."v_student_teacher_rate_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_teacher_lesson_earnings_detail" AS
 SELECT "l"."id" AS "lesson_id",
    "l"."teacher_id",
    "l"."student_id",
    "l"."occurred_at" AS "start_at",
    "l"."duration_min",
    "l"."delivery",
    "l"."state",
    "l"."is_snc",
    "l"."snc_mode",
    "str"."student_tier",
        CASE
            WHEN (("l"."delivery" = 'online'::"public"."delivery") AND ("str"."effective_online_rate_pennies" IS NOT NULL)) THEN "str"."effective_online_rate_pennies"
            WHEN (("l"."delivery" = 'f2f'::"public"."delivery") AND ("str"."effective_f2f_rate_pennies" IS NOT NULL)) THEN "str"."effective_f2f_rate_pennies"
            ELSE NULL::integer
        END AS "hourly_rate_pennies",
        CASE
            WHEN (("l"."delivery" = 'online'::"public"."delivery") AND ("str"."effective_online_rate_pennies" IS NOT NULL)) THEN ("round"(((("l"."duration_min" * "str"."effective_online_rate_pennies"))::numeric / (60)::numeric)))::integer
            WHEN (("l"."delivery" = 'f2f'::"public"."delivery") AND ("str"."effective_f2f_rate_pennies" IS NOT NULL)) THEN ("round"(((("l"."duration_min" * "str"."effective_f2f_rate_pennies"))::numeric / (60)::numeric)))::integer
            ELSE NULL::integer
        END AS "gross_pennies"
   FROM ("public"."lessons" "l"
     LEFT JOIN "public"."v_student_teacher_rate_summary" "str" ON ((("str"."student_id" = "l"."student_id") AND ("str"."teacher_id" = "l"."teacher_id"))))
  WHERE ("l"."state" = 'confirmed'::"public"."lesson_state");


ALTER VIEW "public"."v_teacher_lesson_earnings_detail" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_lesson_margin_detail" AS
 SELECT "e"."lesson_id",
    "e"."teacher_id",
    "e"."student_id",
    "e"."start_at",
    "e"."duration_min",
    "e"."delivery",
    "e"."state",
    "e"."is_snc",
    "e"."snc_mode",
    "e"."student_tier",
    "e"."hourly_rate_pennies",
    "e"."gross_pennies" AS "teacher_earnings_pennies",
    COALESCE("r"."revenue_pennies", 0) AS "revenue_pennies",
    (COALESCE("r"."revenue_pennies", 0) - "e"."gross_pennies") AS "margin_pennies",
        CASE
            WHEN (("r"."revenue_pennies" IS NOT NULL) AND ("r"."revenue_pennies" > 0)) THEN ((((COALESCE("r"."revenue_pennies", 0) - "e"."gross_pennies"))::numeric * 100.0) / ("r"."revenue_pennies")::numeric)
            ELSE NULL::numeric
        END AS "margin_pct"
   FROM ("public"."v_teacher_lesson_earnings_detail" "e"
     LEFT JOIN "public"."v_lesson_revenue_detail" "r" ON (("r"."lesson_id" = "e"."lesson_id")));


ALTER VIEW "public"."v_lesson_margin_detail" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_teacher_drinks_expenses_by_student_month" AS
 SELECT "teacher_id",
    "student_id",
    ("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "incurred_at")))::"date" AS "month_start",
    "sum"(
        CASE
            WHEN (("status" = 'approved'::"text") AND ("category" = 'drinks'::"text")) THEN "amount_pennies"
            ELSE 0
        END) AS "drinks_approved_pennies",
    "sum"(
        CASE
            WHEN (("status" = 'pending'::"text") AND ("category" = 'drinks'::"text")) THEN "amount_pennies"
            ELSE 0
        END) AS "drinks_pending_pennies",
    "sum"(
        CASE
            WHEN (("status" = 'rejected'::"text") AND ("category" = 'drinks'::"text")) THEN "amount_pennies"
            ELSE 0
        END) AS "drinks_rejected_pennies"
   FROM "public"."teacher_expenses"
  GROUP BY "teacher_id", "student_id", (("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "incurred_at")))::"date");


ALTER VIEW "public"."v_teacher_drinks_expenses_by_student_month" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_lesson_margin_with_drinks_detail" AS
 WITH "lesson_totals" AS (
         SELECT "m"."teacher_id",
            "m"."student_id",
            ("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "m"."start_at")))::"date" AS "month_start",
            "sum"(
                CASE
                    WHEN ("m"."delivery" = 'f2f'::"public"."delivery") THEN "m"."duration_min"
                    ELSE 0
                END) AS "total_minutes"
           FROM "public"."v_lesson_margin_detail" "m"
          GROUP BY "m"."teacher_id", "m"."student_id", (("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "m"."start_at")))::"date")
        ), "margin_with_drinks_base" AS (
         SELECT "m"."lesson_id",
            "m"."teacher_id",
            "m"."student_id",
            "m"."start_at",
            "m"."duration_min",
            "m"."delivery",
            "m"."state",
            "m"."is_snc",
            "m"."snc_mode",
            "m"."student_tier",
            "m"."hourly_rate_pennies",
            "m"."teacher_earnings_pennies",
            "m"."revenue_pennies",
            "m"."margin_pennies" AS "margin_before_drinks_pennies",
            "lt"."total_minutes",
            "de"."drinks_approved_pennies"
           FROM (("public"."v_lesson_margin_detail" "m"
             LEFT JOIN "lesson_totals" "lt" ON ((("lt"."teacher_id" = "m"."teacher_id") AND ("lt"."student_id" = "m"."student_id") AND ("lt"."month_start" = ("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "m"."start_at")))::"date"))))
             LEFT JOIN "public"."v_teacher_drinks_expenses_by_student_month" "de" ON ((("de"."teacher_id" = "m"."teacher_id") AND ("de"."student_id" = "m"."student_id") AND ("de"."month_start" = "lt"."month_start"))))
        ), "with_drinks" AS (
         SELECT "b"."lesson_id",
            "b"."teacher_id",
            "b"."student_id",
            "b"."start_at",
            "b"."duration_min",
            "b"."delivery",
            "b"."state",
            "b"."is_snc",
            "b"."snc_mode",
            "b"."student_tier",
            "b"."hourly_rate_pennies",
            "b"."teacher_earnings_pennies",
            "b"."revenue_pennies",
            "b"."margin_before_drinks_pennies",
            "b"."total_minutes",
            "b"."drinks_approved_pennies",
                CASE
                    WHEN (("b"."delivery" = 'f2f'::"public"."delivery") AND ("b"."total_minutes" IS NOT NULL) AND ("b"."total_minutes" > 0) AND ("b"."drinks_approved_pennies" IS NOT NULL)) THEN ("round"(((("b"."duration_min")::numeric * ("b"."drinks_approved_pennies")::numeric) / ("b"."total_minutes")::numeric)))::integer
                    ELSE 0
                END AS "drinks_allocated_pennies"
           FROM "margin_with_drinks_base" "b"
        )
 SELECT "lesson_id",
    "teacher_id",
    "student_id",
    "start_at",
    "duration_min",
    "delivery",
    "state",
    "is_snc",
    "snc_mode",
    "student_tier",
    "hourly_rate_pennies",
    "teacher_earnings_pennies",
    "revenue_pennies",
    "margin_before_drinks_pennies",
    "drinks_allocated_pennies",
    ("margin_before_drinks_pennies" - "drinks_allocated_pennies") AS "margin_after_drinks_pennies",
        CASE
            WHEN ("revenue_pennies" > 0) THEN (((("margin_before_drinks_pennies" - "drinks_allocated_pennies"))::numeric * 100.0) / ("revenue_pennies")::numeric)
            ELSE NULL::numeric
        END AS "margin_after_drinks_pct",
    ("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "start_at")))::"date" AS "month_start",
        CASE
            WHEN ("duration_min" = 60) THEN '60'::"public"."length_cat"
            WHEN ("duration_min" = 90) THEN '90'::"public"."length_cat"
            WHEN ("duration_min" = 120) THEN '120'::"public"."length_cat"
            ELSE 'none'::"public"."length_cat"
        END AS "length_cat"
   FROM "with_drinks";


ALTER VIEW "public"."v_lesson_margin_with_drinks_detail" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_teacher_names" AS
 SELECT "t"."id" AS "teacher_id",
    "p"."full_name",
    COALESCE("p"."preferred_name", "p"."full_name") AS "display_name"
   FROM ("public"."teachers" "t"
     JOIN "public"."profiles" "p" ON (("p"."id" = "t"."profile_id")));


ALTER VIEW "public"."v_teacher_names" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_lesson_margin_with_drinks_with_names" AS
 SELECT "m"."lesson_id",
    "m"."teacher_id",
    "m"."student_id",
    "m"."start_at",
    "m"."duration_min",
    "m"."delivery",
    "m"."state",
    "m"."is_snc",
    "m"."snc_mode",
    "m"."student_tier",
    "m"."hourly_rate_pennies",
    "m"."teacher_earnings_pennies",
    "m"."revenue_pennies",
    "m"."margin_before_drinks_pennies",
    "m"."drinks_allocated_pennies",
    "m"."margin_after_drinks_pennies",
    "m"."margin_after_drinks_pct",
    "m"."month_start",
    "m"."length_cat",
    "tn"."display_name" AS "teacher_name",
    "tn"."full_name" AS "teacher_full_name",
    "sn"."display_name" AS "student_name",
    "sn"."full_name" AS "student_full_name"
   FROM (("public"."v_lesson_margin_with_drinks_detail" "m"
     LEFT JOIN "public"."v_teacher_names" "tn" ON (("tn"."teacher_id" = "m"."teacher_id")))
     LEFT JOIN "public"."v_student_names" "sn" ON (("sn"."student_id" = "m"."student_id")));


ALTER VIEW "public"."v_lesson_margin_with_drinks_with_names" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_lot_allocations_detail" AS
 SELECT "a"."id",
    "a"."credit_lot_id",
    "a"."lesson_id",
    "a"."minutes_allocated",
    "a"."created_at",
    "l"."occurred_at" AS "lesson_occurred_at",
    "l"."duration_min" AS "lesson_duration_min",
    "l"."delivery" AS "lesson_delivery",
    "l"."is_snc" AS "lesson_is_snc",
    "l"."snc_mode" AS "lesson_snc_mode",
    "s"."id" AS "student_id",
    "sp"."full_name" AS "student_full_name",
    "t"."id" AS "teacher_id",
    "tp"."full_name" AS "teacher_full_name"
   FROM ((((("public"."allocations" "a"
     JOIN "public"."lessons" "l" ON (("l"."id" = "a"."lesson_id")))
     JOIN "public"."students" "s" ON (("s"."id" = "l"."student_id")))
     JOIN "public"."profiles" "sp" ON (("sp"."id" = "s"."profile_id")))
     JOIN "public"."teachers" "t" ON (("t"."id" = "l"."teacher_id")))
     JOIN "public"."profiles" "tp" ON (("tp"."id" = "t"."profile_id")));


ALTER VIEW "public"."v_lot_allocations_detail" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_student_last_activity" AS
 SELECT "id" AS "student_id",
    COALESCE(( SELECT "max"("l"."occurred_at") AS "max"
           FROM "public"."lessons" "l"
          WHERE (("l"."student_id" = "s"."id") AND ("l"."state" = 'confirmed'::"public"."lesson_state"))), "created_at") AS "last_activity_at"
   FROM "public"."students" "s";


ALTER VIEW "public"."v_student_last_activity" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_past_students_cleanup_candidates" AS
 SELECT "s"."id" AS "student_id",
    "a"."last_activity_at",
    COALESCE("sum"("v"."minutes_remaining"), (0)::bigint) AS "remaining_minutes"
   FROM (("public"."students" "s"
     JOIN "public"."v_student_last_activity" "a" ON (("a"."student_id" = "s"."id")))
     LEFT JOIN "public"."v_credit_lot_remaining" "v" ON (("v"."student_id" = "s"."id")))
  WHERE ("s"."status" = 'past'::"public"."student_status")
  GROUP BY "s"."id", "a"."last_activity_at";


ALTER VIEW "public"."v_past_students_cleanup_candidates" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_snc_stats_by_month" AS
 WITH "base" AS (
         SELECT ("date_trunc"('month'::"text", "l"."occurred_at"))::"date" AS "month_start",
            "l"."teacher_id",
            "l"."student_id",
            "s"."tier" AS "student_tier",
            "l"."duration_min",
            "l"."is_snc",
            "l"."snc_mode",
            "l"."state",
            COALESCE("m"."revenue_pennies", 0) AS "revenue_pennies",
            COALESCE("m"."teacher_earnings_pennies", 0) AS "teacher_earnings_pennies",
            COALESCE("m"."margin_after_drinks_pennies", 0) AS "margin_after_drinks_pennies"
           FROM (("public"."lessons" "l"
             JOIN "public"."students" "s" ON (("s"."id" = "l"."student_id")))
             LEFT JOIN "public"."v_lesson_margin_with_drinks_with_names" "m" ON (("m"."lesson_id" = "l"."id")))
          WHERE ("l"."state" = 'confirmed'::"public"."lesson_state")
        )
 SELECT "month_start",
    "teacher_id",
    "student_id",
    "student_tier",
    "count"(*) AS "lesson_count_total",
    "sum"("duration_min") AS "lesson_minutes_total",
    "count"(*) FILTER (WHERE "is_snc") AS "snc_lesson_count",
    "sum"("duration_min") FILTER (WHERE "is_snc") AS "snc_minutes_total",
    "count"(*) FILTER (WHERE ("is_snc" AND ("snc_mode" = 'free'::"public"."snc_mode"))) AS "free_snc_lesson_count",
    "sum"("duration_min") FILTER (WHERE ("is_snc" AND ("snc_mode" = 'free'::"public"."snc_mode"))) AS "free_snc_minutes_total",
    "count"(*) FILTER (WHERE ("is_snc" AND ("snc_mode" = 'charged'::"public"."snc_mode"))) AS "charged_snc_lesson_count",
    "sum"("duration_min") FILTER (WHERE ("is_snc" AND ("snc_mode" = 'charged'::"public"."snc_mode"))) AS "charged_snc_minutes_total",
        CASE
            WHEN ("count"(*) = 0) THEN (0)::numeric
            ELSE ((("count"(*) FILTER (WHERE "is_snc"))::numeric * 100.0) / ("count"(*))::numeric)
        END AS "snc_rate_pct",
    "sum"("revenue_pennies") AS "total_revenue_pennies",
    "sum"("teacher_earnings_pennies") AS "total_teacher_pay_pennies",
    "sum"("margin_after_drinks_pennies") AS "total_margin_after_drinks_pennies",
    "sum"("revenue_pennies") FILTER (WHERE "is_snc") AS "snc_revenue_pennies",
    "sum"("teacher_earnings_pennies") FILTER (WHERE "is_snc") AS "snc_teacher_pay_pennies",
    "sum"("margin_after_drinks_pennies") FILTER (WHERE "is_snc") AS "snc_margin_after_drinks_pennies",
    "sum"("revenue_pennies") FILTER (WHERE ("is_snc" AND ("snc_mode" = 'free'::"public"."snc_mode"))) AS "free_snc_revenue_pennies",
    "sum"("teacher_earnings_pennies") FILTER (WHERE ("is_snc" AND ("snc_mode" = 'free'::"public"."snc_mode"))) AS "free_snc_teacher_pay_pennies",
    "sum"("margin_after_drinks_pennies") FILTER (WHERE ("is_snc" AND ("snc_mode" = 'free'::"public"."snc_mode"))) AS "free_snc_margin_after_drinks_pennies",
    "sum"("revenue_pennies") FILTER (WHERE ("is_snc" AND ("snc_mode" = 'charged'::"public"."snc_mode"))) AS "charged_snc_revenue_pennies",
    "sum"("teacher_earnings_pennies") FILTER (WHERE ("is_snc" AND ("snc_mode" = 'charged'::"public"."snc_mode"))) AS "charged_snc_teacher_pay_pennies",
    "sum"("margin_after_drinks_pennies") FILTER (WHERE ("is_snc" AND ("snc_mode" = 'charged'::"public"."snc_mode"))) AS "charged_snc_margin_after_drinks_pennies"
   FROM "base"
  GROUP BY "month_start", "teacher_id", "student_id", "student_tier";


ALTER VIEW "public"."v_snc_stats_by_month" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_snc_stats_by_month_with_names" AS
 SELECT "v"."month_start",
    "v"."teacher_id",
    COALESCE("pt"."preferred_name", "pt"."full_name") AS "teacher_name",
    "v"."student_id",
    COALESCE("ps"."preferred_name", "ps"."full_name") AS "student_name",
    "v"."student_tier",
    "v"."lesson_count_total",
    "v"."lesson_minutes_total",
    "v"."snc_lesson_count",
    "v"."snc_minutes_total",
    "v"."free_snc_lesson_count",
    "v"."free_snc_minutes_total",
    "v"."charged_snc_lesson_count",
    "v"."charged_snc_minutes_total",
    "v"."snc_rate_pct",
    "v"."total_revenue_pennies",
    "v"."total_teacher_pay_pennies",
    "v"."total_margin_after_drinks_pennies",
    "v"."snc_revenue_pennies",
    "v"."snc_teacher_pay_pennies",
    "v"."snc_margin_after_drinks_pennies",
    "v"."free_snc_revenue_pennies",
    "v"."free_snc_teacher_pay_pennies",
    "v"."free_snc_margin_after_drinks_pennies",
    "v"."charged_snc_revenue_pennies",
    "v"."charged_snc_teacher_pay_pennies",
    "v"."charged_snc_margin_after_drinks_pennies"
   FROM (((("public"."v_snc_stats_by_month" "v"
     LEFT JOIN "public"."teachers" "t" ON (("t"."id" = "v"."teacher_id")))
     LEFT JOIN "public"."profiles" "pt" ON (("pt"."id" = "t"."profile_id")))
     LEFT JOIN "public"."students" "s" ON (("s"."id" = "v"."student_id")))
     LEFT JOIN "public"."profiles" "ps" ON (("ps"."id" = "s"."profile_id")));


ALTER VIEW "public"."v_snc_stats_by_month_with_names" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_student_award_reason_summary" AS
 SELECT "student_id",
    "award_reason_code",
    (COALESCE("sum"("minutes_granted") FILTER (WHERE ("source_type" = 'award'::"text")), (0)::bigint))::integer AS "granted_award_min",
    (COALESCE("sum"("minutes_allocated") FILTER (WHERE ("source_type" = 'award'::"text")), (0)::bigint))::integer AS "used_award_min",
    (COALESCE("sum"("minutes_remaining") FILTER (WHERE ("source_type" = 'award'::"text")), (0)::bigint))::integer AS "remaining_award_min"
   FROM "public"."v_credit_lot_remaining"
  GROUP BY "student_id", "award_reason_code";


ALTER VIEW "public"."v_student_award_reason_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_student_cohort_base" AS
 WITH "first_lessons" AS (
         SELECT "l"."student_id",
            "min"("l"."occurred_at") AS "first_lesson_at"
           FROM "public"."lessons" "l"
          WHERE ("l"."state" = 'confirmed'::"public"."lesson_state")
          GROUP BY "l"."student_id"
        ), "first_teacher" AS (
         SELECT DISTINCT ON ("l"."student_id") "l"."student_id",
            "l"."teacher_id" AS "first_teacher_id"
           FROM ("public"."lessons" "l"
             JOIN "first_lessons" "fl" ON (("fl"."student_id" = "l"."student_id")))
          WHERE ("l"."state" = 'confirmed'::"public"."lesson_state")
          ORDER BY "l"."student_id", "l"."occurred_at", "l"."id"
        ), "lesson_gaps" AS (
         SELECT "l"."student_id",
            "l"."occurred_at",
            "lag"("l"."occurred_at") OVER (PARTITION BY "l"."student_id" ORDER BY "l"."occurred_at") AS "prev_occurred_at"
           FROM "public"."lessons" "l"
          WHERE ("l"."state" = 'confirmed'::"public"."lesson_state")
        ), "cohort_agg" AS (
         SELECT "s"."id" AS "student_id",
            ("date_trunc"('month'::"text", "fl"."first_lesson_at"))::"date" AS "cohort_month",
            "fl"."first_lesson_at",
            "ft"."first_teacher_id",
            "s"."tier" AS "student_tier",
            "s"."status" AS "current_status",
            "sum"("l"."duration_min") FILTER (WHERE (("l"."occurred_at" >= "fl"."first_lesson_at") AND ("l"."occurred_at" < ("fl"."first_lesson_at" + '3 mons'::interval)))) AS "minutes_0_3m",
            "sum"("l"."duration_min") FILTER (WHERE (("l"."occurred_at" >= "fl"."first_lesson_at") AND ("l"."occurred_at" < ("fl"."first_lesson_at" + '6 mons'::interval)))) AS "minutes_0_6m",
            "sum"("l"."duration_min") FILTER (WHERE (("l"."occurred_at" >= "fl"."first_lesson_at") AND ("l"."occurred_at" < ("fl"."first_lesson_at" + '1 year'::interval)))) AS "minutes_0_12m",
            "bool_or"((("l"."occurred_at" >= "fl"."first_lesson_at") AND ("l"."occurred_at" < ("fl"."first_lesson_at" + '3 mons'::interval)))) AS "active_0_3m",
            "bool_or"((("l"."occurred_at" >= "fl"."first_lesson_at") AND ("l"."occurred_at" < ("fl"."first_lesson_at" + '6 mons'::interval)))) AS "active_0_6m",
            "bool_or"((("l"."occurred_at" >= "fl"."first_lesson_at") AND ("l"."occurred_at" < ("fl"."first_lesson_at" + '1 year'::interval)))) AS "active_0_12m",
            (EXISTS ( SELECT 1
                   FROM "lesson_gaps" "g"
                  WHERE (("g"."student_id" = "s"."id") AND ("g"."prev_occurred_at" IS NOT NULL) AND (("g"."occurred_at" - "g"."prev_occurred_at") >= '90 days'::interval)))) AS "has_long_gap_history",
            ((EXISTS ( SELECT 1
                   FROM "lesson_gaps" "g"
                  WHERE (("g"."student_id" = "s"."id") AND ("g"."prev_occurred_at" IS NOT NULL) AND (("g"."occurred_at" - "g"."prev_occurred_at") >= '90 days'::interval)))) AND ("s"."status" = 'current'::"public"."student_status")) AS "reactivated"
           FROM ((("public"."students" "s"
             JOIN "first_lessons" "fl" ON (("fl"."student_id" = "s"."id")))
             LEFT JOIN "first_teacher" "ft" ON (("ft"."student_id" = "s"."id")))
             LEFT JOIN "public"."lessons" "l" ON ((("l"."student_id" = "s"."id") AND ("l"."state" = 'confirmed'::"public"."lesson_state"))))
          GROUP BY "s"."id", "fl"."first_lesson_at", "ft"."first_teacher_id", "s"."tier", "s"."status"
        )
 SELECT "student_id",
    "cohort_month",
    "first_lesson_at",
    "first_teacher_id",
    "student_tier",
    "current_status",
    "minutes_0_3m",
    "minutes_0_6m",
    "minutes_0_12m",
    "active_0_3m",
    "active_0_6m",
    "active_0_12m",
    "has_long_gap_history",
    "reactivated"
   FROM "cohort_agg";


ALTER VIEW "public"."v_student_cohort_base" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_student_cohort_summary" AS
 SELECT "cb"."cohort_month",
    "cb"."student_tier",
    "cb"."first_teacher_id",
    COALESCE("pt"."preferred_name", "pt"."full_name") AS "first_teacher_name",
    "count"(*) AS "cohort_size",
    "sum"(
        CASE
            WHEN "cb"."active_0_3m" THEN 1
            ELSE 0
        END) AS "active_0_3m_count",
    "sum"(
        CASE
            WHEN "cb"."active_0_6m" THEN 1
            ELSE 0
        END) AS "active_0_6m_count",
    "sum"(
        CASE
            WHEN "cb"."active_0_12m" THEN 1
            ELSE 0
        END) AS "active_0_12m_count",
        CASE
            WHEN ("count"(*) = 0) THEN (0)::numeric
            ELSE ((("sum"(
            CASE
                WHEN "cb"."active_0_3m" THEN 1
                ELSE 0
            END))::numeric * 100.0) / ("count"(*))::numeric)
        END AS "active_0_3m_pct",
        CASE
            WHEN ("count"(*) = 0) THEN (0)::numeric
            ELSE ((("sum"(
            CASE
                WHEN "cb"."active_0_6m" THEN 1
                ELSE 0
            END))::numeric * 100.0) / ("count"(*))::numeric)
        END AS "active_0_6m_pct",
        CASE
            WHEN ("count"(*) = 0) THEN (0)::numeric
            ELSE ((("sum"(
            CASE
                WHEN "cb"."active_0_12m" THEN 1
                ELSE 0
            END))::numeric * 100.0) / ("count"(*))::numeric)
        END AS "active_0_12m_pct",
    "sum"("cb"."minutes_0_3m") AS "minutes_0_3m_total",
    "sum"("cb"."minutes_0_6m") AS "minutes_0_6m_total",
    "sum"("cb"."minutes_0_12m") AS "minutes_0_12m_total",
    "avg"("cb"."minutes_0_3m") AS "minutes_0_3m_avg",
    "avg"("cb"."minutes_0_6m") AS "minutes_0_6m_avg",
    "avg"("cb"."minutes_0_12m") AS "minutes_0_12m_avg",
    "sum"(
        CASE
            WHEN "cb"."reactivated" THEN 1
            ELSE 0
        END) AS "reactivated_count"
   FROM (("public"."v_student_cohort_base" "cb"
     LEFT JOIN "public"."teachers" "t" ON (("t"."id" = "cb"."first_teacher_id")))
     LEFT JOIN "public"."profiles" "pt" ON (("pt"."id" = "t"."profile_id")))
  GROUP BY "cb"."cohort_month", "cb"."student_tier", "cb"."first_teacher_id", COALESCE("pt"."preferred_name", "pt"."full_name");


ALTER VIEW "public"."v_student_cohort_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_student_credit_delivery_summary" AS
 WITH "base" AS (
         SELECT "v"."student_id",
            "v"."source_type",
            "v"."delivery_restriction",
            "v"."minutes_granted",
            "v"."minutes_allocated",
            "v"."minutes_remaining"
           FROM "public"."v_credit_lot_remaining" "v"
        )
 SELECT "student_id",
    (COALESCE("sum"("minutes_granted") FILTER (WHERE (("source_type" = 'invoice'::"text") AND ("minutes_granted" > 0))), (0)::bigint))::integer AS "purchased_min",
    (COALESCE("sum"("minutes_granted") FILTER (WHERE (("source_type" = 'award'::"text") AND ("minutes_granted" > 0))), (0)::bigint))::integer AS "awarded_min",
    (COALESCE("sum"("minutes_allocated"), (0)::bigint))::integer AS "used_min",
    (COALESCE("sum"("minutes_remaining"), (0)::bigint))::integer AS "remaining_min",
    (COALESCE("sum"("minutes_granted") FILTER (WHERE (("source_type" = 'invoice'::"text") AND ("minutes_granted" > 0) AND ("delivery_restriction" = 'online'::"public"."delivery"))), (0)::bigint))::integer AS "purchased_online_min",
    (COALESCE("sum"("minutes_granted") FILTER (WHERE (("source_type" = 'invoice'::"text") AND ("minutes_granted" > 0) AND ("delivery_restriction" = 'f2f'::"public"."delivery"))), (0)::bigint))::integer AS "purchased_f2f_min",
    (COALESCE("sum"("minutes_allocated") FILTER (WHERE ("delivery_restriction" = 'online'::"public"."delivery")), (0)::bigint))::integer AS "used_online_min",
    (COALESCE("sum"("minutes_allocated") FILTER (WHERE ("delivery_restriction" = 'f2f'::"public"."delivery")), (0)::bigint))::integer AS "used_f2f_min",
    (COALESCE("sum"("minutes_remaining") FILTER (WHERE ("delivery_restriction" = 'online'::"public"."delivery")), (0)::bigint))::integer AS "remaining_online_min",
    (COALESCE("sum"("minutes_remaining") FILTER (WHERE ("delivery_restriction" = 'f2f'::"public"."delivery")), (0)::bigint))::integer AS "remaining_f2f_min"
   FROM "base"
  GROUP BY "student_id";


ALTER VIEW "public"."v_student_credit_delivery_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_student_credit_summary" AS
 WITH "s" AS (
         SELECT "v"."student_id",
            (COALESCE("sum"("v"."minutes_granted"), (0)::bigint))::integer AS "total_granted_min",
            (COALESCE("sum"("v"."minutes_allocated"), (0)::bigint))::integer AS "total_allocated_min",
            (COALESCE("sum"("v"."minutes_remaining"), (0)::bigint))::integer AS "total_remaining_min",
            "min"(
                CASE
                    WHEN (("v"."expiry_date" IS NOT NULL) AND ("v"."expiry_date" >= CURRENT_DATE)) THEN "v"."expiry_date"
                    ELSE NULL::"date"
                END) AS "next_expiry_date"
           FROM "public"."v_credit_lot_remaining" "v"
          GROUP BY "v"."student_id"
        )
 SELECT "st"."id" AS "student_id",
    COALESCE("s"."total_granted_min", 0) AS "total_granted_min",
    COALESCE("s"."total_allocated_min", 0) AS "total_allocated_min",
    COALESCE("s"."total_remaining_min", 0) AS "total_remaining_min",
    "public"."fn_is_generic_low_credit"(COALESCE("s"."total_remaining_min", 0)) AS "low_credit",
    "s"."next_expiry_date",
        CASE
            WHEN ("s"."next_expiry_date" IS NULL) THEN NULL::integer
            ELSE ("s"."next_expiry_date" - CURRENT_DATE)
        END AS "days_to_next_expiry",
        CASE
            WHEN ("s"."next_expiry_date" IS NULL) THEN false
            ELSE ("s"."next_expiry_date" <= (CURRENT_DATE + 30))
        END AS "expiry_within_30d"
   FROM ("public"."students" "st"
     LEFT JOIN "s" ON (("s"."student_id" = "st"."id")));


ALTER VIEW "public"."v_student_credit_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_student_usage_last_3m" AS
 WITH "monthly" AS (
         SELECT "l"."student_id",
            "date_trunc"('month'::"text", "l"."occurred_at") AS "month_start",
            "sum"("l"."duration_min") AS "minutes_taken"
           FROM "public"."lessons" "l"
          WHERE (("l"."state" = 'confirmed'::"public"."lesson_state") AND ("l"."occurred_at" >= "date_trunc"('month'::"text", ("now"() - '3 mons'::interval))))
          GROUP BY "l"."student_id", ("date_trunc"('month'::"text", "l"."occurred_at"))
        ), "agg" AS (
         SELECT "m"."student_id",
            "count"(*) AS "months_count",
            "sum"("m"."minutes_taken") AS "minutes_last_3m",
            "avg"("m"."minutes_taken") AS "avg_month_minutes"
           FROM "monthly" "m"
          GROUP BY "m"."student_id"
        )
 SELECT "student_id",
    "months_count",
    "minutes_last_3m",
    "avg_month_minutes",
    ("avg_month_minutes" / 60.0) AS "avg_month_hours",
    (("avg_month_minutes" / 60.0) / 4.3) AS "avg_week_hours",
    "public"."fn_is_heavy_user"("avg_month_minutes") AS "is_heavy_user"
   FROM "agg";


ALTER VIEW "public"."v_student_usage_last_3m" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_student_dynamic_credit_alerts" AS
 SELECT "cs"."student_id",
    "cs"."total_remaining_min" AS "remaining_minutes",
    (("cs"."total_remaining_min")::numeric / 60.0) AS "remaining_hours",
    "u"."avg_month_hours",
    ((("cs"."total_remaining_min")::numeric / 60.0) - COALESCE("u"."avg_month_hours", (0)::numeric)) AS "buffer_hours",
    "public"."fn_is_generic_low_credit"("cs"."total_remaining_min") AS "is_generic_low",
    "public"."fn_is_dynamic_low"((("cs"."total_remaining_min")::numeric / 60.0), "u"."avg_month_hours") AS "is_dynamic_low",
    ("public"."fn_is_generic_low_credit"("cs"."total_remaining_min") OR "public"."fn_is_dynamic_low"((("cs"."total_remaining_min")::numeric / 60.0), "u"."avg_month_hours")) AS "is_low_any"
   FROM (("public"."v_student_credit_summary" "cs"
     JOIN "public"."students" "s" ON ((("s"."id" = "cs"."student_id") AND ("s"."status" <> 'past'::"public"."student_status"))))
     LEFT JOIN "public"."v_student_usage_last_3m" "u" ON (("u"."student_id" = "cs"."student_id")));


ALTER VIEW "public"."v_student_dynamic_credit_alerts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_student_dynamic_credit_alerts_by_delivery" AS
 WITH "purchased_by_delivery" AS (
         SELECT "s"."student_id",
            'online'::"public"."delivery" AS "delivery",
            "s"."purchased_online_min" AS "purchased_minutes"
           FROM "public"."v_student_credit_delivery_summary" "s"
          WHERE ("s"."purchased_online_min" > 0)
        UNION ALL
         SELECT "s"."student_id",
            'f2f'::"public"."delivery" AS "delivery",
            "s"."purchased_f2f_min" AS "purchased_minutes"
           FROM "public"."v_student_credit_delivery_summary" "s"
          WHERE ("s"."purchased_f2f_min" > 0)
        ), "remaining_by_delivery" AS (
         SELECT "v"."student_id",
            "v"."delivery_restriction" AS "delivery",
            ("sum"("v"."minutes_remaining"))::integer AS "remaining_minutes"
           FROM ("public"."v_credit_lot_remaining" "v"
             JOIN "public"."students" "s" ON ((("s"."id" = "v"."student_id") AND ("s"."status" <> 'past'::"public"."student_status"))))
          WHERE (("v"."source_type" = 'invoice'::"text") AND ("v"."state" = 'open'::"public"."credit_lot_state") AND (("v"."expiry_date" IS NULL) OR ("v"."expiry_date" >= CURRENT_DATE)) AND ("v"."delivery_restriction" = ANY (ARRAY['online'::"public"."delivery", 'f2f'::"public"."delivery"])))
          GROUP BY "v"."student_id", "v"."delivery_restriction"
        ), "monthly_by_delivery" AS (
         SELECT "l"."student_id",
            "l"."delivery",
            "date_trunc"('month'::"text", "l"."occurred_at") AS "month_start",
            "sum"("l"."duration_min") AS "minutes_taken"
           FROM "public"."lessons" "l"
          WHERE (("l"."state" = 'confirmed'::"public"."lesson_state") AND ("l"."delivery" = ANY (ARRAY['online'::"public"."delivery", 'f2f'::"public"."delivery"])) AND ("l"."occurred_at" >= "date_trunc"('month'::"text", ("now"() - '3 mons'::interval))))
          GROUP BY "l"."student_id", "l"."delivery", ("date_trunc"('month'::"text", "l"."occurred_at"))
        ), "usage_by_delivery" AS (
         SELECT "m"."student_id",
            "m"."delivery",
            "count"(*) AS "months_count",
            "sum"("m"."minutes_taken") AS "minutes_last_3m",
            "avg"("m"."minutes_taken") AS "avg_month_minutes"
           FROM "monthly_by_delivery" "m"
          GROUP BY "m"."student_id", "m"."delivery"
        ), "base" AS (
         SELECT "p"."student_id",
            "p"."delivery",
            "p"."purchased_minutes",
            COALESCE("r"."remaining_minutes", 0) AS "remaining_minutes"
           FROM ("purchased_by_delivery" "p"
             LEFT JOIN "remaining_by_delivery" "r" ON ((("r"."student_id" = "p"."student_id") AND ("r"."delivery" = "p"."delivery"))))
        )
 SELECT "b"."student_id",
    "b"."delivery",
    "b"."remaining_minutes",
    (("b"."remaining_minutes")::numeric / 60.0) AS "remaining_hours",
    ("u"."avg_month_minutes" / 60.0) AS "avg_month_hours",
    ((("b"."remaining_minutes")::numeric / 60.0) - COALESCE(("u"."avg_month_minutes" / 60.0), 0.0)) AS "buffer_hours",
    ("b"."remaining_minutes" <= 360) AS "is_generic_low",
    (("u"."avg_month_minutes" IS NOT NULL) AND ("u"."avg_month_minutes" > 0.0) AND (((("b"."remaining_minutes")::numeric / 60.0) - ("u"."avg_month_minutes" / 60.0)) < 4.0)) AS "is_dynamic_low",
    ("b"."remaining_minutes" <= 0) AS "is_zero_purchased",
    (("b"."remaining_minutes" <= 360) OR (("u"."avg_month_minutes" IS NOT NULL) AND ("u"."avg_month_minutes" > 0.0) AND (((("b"."remaining_minutes")::numeric / 60.0) - ("u"."avg_month_minutes" / 60.0)) < 4.0))) AS "is_low_any"
   FROM ("base" "b"
     LEFT JOIN "usage_by_delivery" "u" ON ((("u"."student_id" = "b"."student_id") AND ("u"."delivery" = "b"."delivery"))));


ALTER VIEW "public"."v_student_dynamic_credit_alerts_by_delivery" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_student_lessons" AS
 WITH "lesson_allocs" AS (
         SELECT "a"."lesson_id",
            "string_agg"((((
                CASE "cl"."source_type"
                    WHEN 'overdraft'::"text" THEN 'Overdraft'::"text"
                    WHEN 'invoice'::"text" THEN COALESCE("cl"."external_ref", 'Invoice credit'::"text")
                    WHEN 'award'::"text" THEN COALESCE(('Award: '::"text" || "cl"."award_reason_code"), 'Award credit'::"text")
                    WHEN 'adjustment'::"text" THEN 'Adjustment'::"text"
                    ELSE "cl"."source_type"
                END || ' ('::"text") || ("a"."minutes_allocated")::"text") || ' min)'::"text"), ', '::"text" ORDER BY "cl"."source_type", "cl"."start_date" NULLS FIRST, "cl"."id") AS "allocation_summary"
           FROM ("public"."allocations" "a"
             JOIN "public"."credit_lots" "cl" ON (("cl"."id" = "a"."credit_lot_id")))
          GROUP BY "a"."lesson_id"
        )
 SELECT "l"."id" AS "lesson_id",
    "l"."student_id",
    "l"."teacher_id",
    "p"."full_name" AS "teacher_full_name",
    "l"."occurred_at",
    "l"."duration_min",
    "l"."delivery",
    "l"."length_cat",
    "l"."is_snc",
    "l"."snc_mode",
    "l"."state",
    "l"."created_at",
    "la"."allocation_summary"
   FROM ((("public"."lessons" "l"
     LEFT JOIN "public"."teachers" "t" ON (("t"."id" = "l"."teacher_id")))
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "t"."profile_id")))
     LEFT JOIN "lesson_allocs" "la" ON (("la"."lesson_id" = "l"."id")));


ALTER VIEW "public"."v_student_lessons" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_student_lifecycle_summary" AS
 SELECT ("count"(*) FILTER (WHERE ("status" = 'current'::"public"."student_status")))::integer AS "current",
    ("count"(*) FILTER (WHERE ("status" = 'dormant'::"public"."student_status")))::integer AS "dormant",
    ("count"(*) FILTER (WHERE ("status" = 'past'::"public"."student_status")))::integer AS "past"
   FROM "public"."students";


ALTER VIEW "public"."v_student_lifecycle_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_student_snc_lessons" AS
 SELECT "id" AS "lesson_id",
    "student_id",
    "teacher_id",
    "occurred_at",
    "duration_min",
    "delivery",
    "is_snc",
    "snc_mode",
    ("snc_mode" = 'charged'::"public"."snc_mode") AS "is_charged"
   FROM "public"."lessons" "l"
  WHERE "public"."fn_is_snc_lesson"("is_snc", "state");


ALTER VIEW "public"."v_student_snc_lessons" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_student_snc_status_by_month" AS
 SELECT "student_id",
    ("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "occurred_at")))::"date" AS "month_start",
    "count"(*) FILTER (WHERE ("snc_mode" = 'free'::"public"."snc_mode")) AS "free_sncs",
    "count"(*) FILTER (WHERE ("snc_mode" = 'charged'::"public"."snc_mode")) AS "charged_sncs",
    ("count"(*) FILTER (WHERE ("snc_mode" = 'free'::"public"."snc_mode")) > 0) AS "has_free_snc_used"
   FROM "public"."lessons" "l"
  WHERE "public"."fn_is_snc_lesson"("is_snc", "state")
  GROUP BY "student_id", (("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "occurred_at")))::"date");


ALTER VIEW "public"."v_student_snc_status_by_month" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_student_snc_status_previous_month" AS
 SELECT "student_id",
    "free_sncs",
    "charged_sncs",
    "has_free_snc_used"
   FROM "public"."v_student_snc_status_by_month"
  WHERE ("month_start" = ("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", ("now"() - '1 mon'::interval))))::"date");


ALTER VIEW "public"."v_student_snc_status_previous_month" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_teacher_expenses_detail_by_month" AS
 SELECT "e"."id",
    "e"."teacher_id",
    ("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "e"."incurred_at")))::"date" AS "month_start",
    "e"."incurred_at",
    "e"."amount_pennies",
    "e"."status",
    "e"."description",
    "e"."category",
    "e"."created_at",
    "e"."updated_at",
    "e"."student_id",
    "sn"."display_name" AS "student_name",
    "sn"."full_name" AS "student_full_name"
   FROM ("public"."teacher_expenses" "e"
     LEFT JOIN "public"."v_student_names" "sn" ON (("sn"."student_id" = "e"."student_id")));


ALTER VIEW "public"."v_teacher_expenses_detail_by_month" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_teacher_expenses_summary" AS
 SELECT "teacher_id",
    ("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "incurred_at")))::"date" AS "month_start",
    "sum"(
        CASE
            WHEN ("status" = 'approved'::"text") THEN "amount_pennies"
            ELSE 0
        END) AS "approved_pennies",
    "sum"(
        CASE
            WHEN ("status" = 'pending'::"text") THEN "amount_pennies"
            ELSE 0
        END) AS "pending_pennies",
    "sum"(
        CASE
            WHEN ("status" = 'rejected'::"text") THEN "amount_pennies"
            ELSE 0
        END) AS "rejected_pennies"
   FROM "public"."teacher_expenses" "e"
  GROUP BY "teacher_id", (("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "incurred_at")))::"date");


ALTER VIEW "public"."v_teacher_expenses_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_teacher_lesson_earnings_by_month" AS
 SELECT "teacher_id",
    ("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "start_at")))::"date" AS "month_start",
    "sum"("duration_min") AS "lesson_minutes_total",
    "sum"("gross_pennies") AS "gross_pennies",
    "sum"(
        CASE
            WHEN ("is_snc" AND ("snc_mode" = 'free'::"public"."snc_mode")) THEN "duration_min"
            ELSE 0
        END) AS "snc_free_minutes",
    "sum"(
        CASE
            WHEN ("is_snc" AND ("snc_mode" = 'charged'::"public"."snc_mode")) THEN "duration_min"
            ELSE 0
        END) AS "snc_charged_minutes"
   FROM "public"."v_teacher_lesson_earnings_detail" "d"
  GROUP BY "teacher_id", (("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "start_at")))::"date");


ALTER VIEW "public"."v_teacher_lesson_earnings_by_month" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_teacher_invoice_summary" AS
 WITH "month_keys" AS (
         SELECT "e"."teacher_id",
            "e"."month_start"
           FROM "public"."v_teacher_lesson_earnings_by_month" "e"
        UNION
         SELECT "x"."teacher_id",
            "x"."month_start"
           FROM "public"."v_teacher_expenses_summary" "x"
        UNION
         SELECT "ti"."teacher_id",
            "ti"."month_start"
           FROM "public"."teacher_invoices" "ti"
        ), "combined" AS (
         SELECT "mk"."teacher_id",
            "mk"."month_start",
            COALESCE("e"."gross_pennies", (0)::bigint) AS "lesson_gross_pennies",
            COALESCE("x"."approved_pennies", (0)::bigint) AS "expenses_pennies",
            (COALESCE("e"."gross_pennies", (0)::bigint) + COALESCE("x"."approved_pennies", (0)::bigint)) AS "total_pennies",
            "ti"."id" AS "invoice_id",
            "ti"."status" AS "invoice_status"
           FROM ((("month_keys" "mk"
             LEFT JOIN "public"."v_teacher_lesson_earnings_by_month" "e" ON ((("e"."teacher_id" = "mk"."teacher_id") AND ("e"."month_start" = "mk"."month_start"))))
             LEFT JOIN "public"."v_teacher_expenses_summary" "x" ON ((("x"."teacher_id" = "mk"."teacher_id") AND ("x"."month_start" = "mk"."month_start"))))
             LEFT JOIN "public"."teacher_invoices" "ti" ON ((("ti"."teacher_id" = "mk"."teacher_id") AND ("ti"."month_start" = "mk"."month_start"))))
        )
 SELECT "teacher_id",
    "month_start",
    "lesson_gross_pennies",
    "expenses_pennies",
    "total_pennies",
        CASE
            WHEN ("invoice_id" IS NULL) THEN 'not_generated'::"text"
            WHEN ("invoice_status" = 'paid'::"text") THEN 'paid'::"text"
            ELSE 'generated'::"text"
        END AS "status"
   FROM "combined";


ALTER VIEW "public"."v_teacher_invoice_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_teacher_last_activity" AS
 SELECT "t"."id" AS "teacher_id",
    COALESCE("max"("l"."occurred_at"), "t"."created_at") AS "last_activity_at"
   FROM ("public"."teachers" "t"
     LEFT JOIN "public"."lessons" "l" ON ((("l"."teacher_id" = "t"."id") AND ("l"."state" = 'confirmed'::"public"."lesson_state"))))
  GROUP BY "t"."id", "t"."created_at";


ALTER VIEW "public"."v_teacher_last_activity" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_teacher_lesson_earnings_by_student_month" AS
 SELECT "d"."teacher_id",
    "d"."student_id",
    "sn"."display_name" AS "student_name",
    ("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "d"."start_at")))::"date" AS "month_start",
    "sum"("d"."duration_min") AS "lesson_minutes_total",
    "sum"("d"."gross_pennies") AS "gross_pennies"
   FROM ("public"."v_teacher_lesson_earnings_detail" "d"
     LEFT JOIN "public"."v_student_names" "sn" ON (("sn"."student_id" = "d"."student_id")))
  GROUP BY "d"."teacher_id", "d"."student_id", "sn"."display_name", (("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "d"."start_at")))::"date");


ALTER VIEW "public"."v_teacher_lesson_earnings_by_student_month" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_teacher_lesson_earnings_last_month" AS
 WITH "bounds" AS (
         SELECT ("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "now"())))::"date" AS "current_month_start"
        )
 SELECT "e"."teacher_id",
    "e"."month_start",
    "e"."lesson_minutes_total",
    "e"."gross_pennies",
    "e"."snc_free_minutes",
    "e"."snc_charged_minutes"
   FROM ("public"."v_teacher_lesson_earnings_by_month" "e"
     JOIN "bounds" "b" ON (("e"."month_start" = (("b"."current_month_start" - '1 mon'::interval))::"date")));


ALTER VIEW "public"."v_teacher_lesson_earnings_last_month" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_teacher_lesson_margin_by_student_month" AS
 SELECT "m"."teacher_id",
    "m"."student_id",
    "sn"."display_name" AS "student_name",
    ("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "m"."start_at")))::"date" AS "month_start",
    "sum"("m"."duration_min") AS "lesson_minutes_total",
    "sum"("m"."revenue_pennies") AS "revenue_pennies",
    "sum"("m"."teacher_earnings_pennies") AS "teacher_earnings_pennies",
    ("sum"("m"."revenue_pennies") - "sum"("m"."teacher_earnings_pennies")) AS "margin_pennies",
        CASE
            WHEN ("sum"("m"."revenue_pennies") > 0) THEN (((("sum"("m"."revenue_pennies") - "sum"("m"."teacher_earnings_pennies")))::numeric * 100.0) / ("sum"("m"."revenue_pennies"))::numeric)
            ELSE NULL::numeric
        END AS "margin_pct"
   FROM ("public"."v_lesson_margin_detail" "m"
     LEFT JOIN "public"."v_student_names" "sn" ON (("sn"."student_id" = "m"."student_id")))
  GROUP BY "m"."teacher_id", "m"."student_id", "sn"."display_name", (("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "m"."start_at")))::"date");


ALTER VIEW "public"."v_teacher_lesson_margin_by_student_month" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_teacher_lesson_revenue_by_month" AS
 SELECT "l"."teacher_id",
    ("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "l"."occurred_at")))::"date" AS "month_start",
    "sum"("r"."revenue_pennies") AS "revenue_pennies"
   FROM ("public"."lessons" "l"
     JOIN "public"."v_lesson_revenue_detail" "r" ON (("r"."lesson_id" = "l"."id")))
  WHERE ("l"."state" = 'confirmed'::"public"."lesson_state")
  GROUP BY "l"."teacher_id", (("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "l"."occurred_at")))::"date");


ALTER VIEW "public"."v_teacher_lesson_revenue_by_month" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_teacher_lesson_stats_by_month" AS
 SELECT "teacher_id",
    ("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "occurred_at")))::"date" AS "month_start",
    "count"(*) AS "lesson_count_total",
    ("sum"("duration_min"))::integer AS "confirmed_minutes_total",
    ("sum"(
        CASE
            WHEN ("delivery" = 'online'::"public"."delivery") THEN "duration_min"
            ELSE 0
        END))::integer AS "confirmed_minutes_online",
    ("sum"(
        CASE
            WHEN ("delivery" = 'f2f'::"public"."delivery") THEN "duration_min"
            ELSE 0
        END))::integer AS "confirmed_minutes_f2f",
    "count"(*) FILTER (WHERE ("is_snc" AND ("snc_mode" = 'free'::"public"."snc_mode"))) AS "snc_free_count",
    "count"(*) FILTER (WHERE ("is_snc" AND ("snc_mode" = 'charged'::"public"."snc_mode"))) AS "snc_charged_count"
   FROM "public"."lessons" "l"
  WHERE ("state" = 'confirmed'::"public"."lesson_state")
  GROUP BY "teacher_id", (("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "occurred_at")))::"date");


ALTER VIEW "public"."v_teacher_lesson_stats_by_month" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_teacher_lessons" AS
 SELECT "l"."id",
    "l"."teacher_id",
    "l"."student_id",
    "l"."occurred_at" AS "start_at",
    "l"."duration_min",
    "l"."state",
    "vs"."display_name" AS "student_name"
   FROM ("public"."lessons" "l"
     LEFT JOIN "public"."v_student_names" "vs" ON (("vs"."student_id" = "l"."student_id")));


ALTER VIEW "public"."v_teacher_lessons" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_teacher_margin_by_month" AS
 WITH "revenue" AS (
         SELECT "v_teacher_lesson_revenue_by_month"."teacher_id",
            "v_teacher_lesson_revenue_by_month"."month_start",
            "v_teacher_lesson_revenue_by_month"."revenue_pennies"
           FROM "public"."v_teacher_lesson_revenue_by_month"
        ), "earnings" AS (
         SELECT "v_teacher_lesson_earnings_by_month"."teacher_id",
            "v_teacher_lesson_earnings_by_month"."month_start",
            "v_teacher_lesson_earnings_by_month"."lesson_minutes_total",
            "v_teacher_lesson_earnings_by_month"."gross_pennies",
            "v_teacher_lesson_earnings_by_month"."snc_free_minutes",
            "v_teacher_lesson_earnings_by_month"."snc_charged_minutes"
           FROM "public"."v_teacher_lesson_earnings_by_month"
        ), "expenses" AS (
         SELECT "teacher_expenses"."teacher_id",
            ("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "teacher_expenses"."incurred_at")))::"date" AS "month_start",
            "sum"(
                CASE
                    WHEN (("teacher_expenses"."status" = 'approved'::"text") AND ("teacher_expenses"."category" = 'drinks'::"text")) THEN "teacher_expenses"."amount_pennies"
                    ELSE 0
                END) AS "expenses_approved_pennies",
            "sum"(
                CASE
                    WHEN (("teacher_expenses"."status" = 'pending'::"text") AND ("teacher_expenses"."category" = 'drinks'::"text")) THEN "teacher_expenses"."amount_pennies"
                    ELSE 0
                END) AS "expenses_pending_pennies",
            "sum"(
                CASE
                    WHEN (("teacher_expenses"."status" = 'rejected'::"text") AND ("teacher_expenses"."category" = 'drinks'::"text")) THEN "teacher_expenses"."amount_pennies"
                    ELSE 0
                END) AS "expenses_rejected_pennies"
           FROM "public"."teacher_expenses"
          GROUP BY "teacher_expenses"."teacher_id", (("date_trunc"('month'::"text", "timezone"('Europe/London'::"text", "teacher_expenses"."incurred_at")))::"date")
        ), "joined" AS (
         SELECT COALESCE("r"."teacher_id", "e"."teacher_id", "x"."teacher_id") AS "teacher_id",
            COALESCE("r"."month_start", "e"."month_start", "x"."month_start") AS "month_start",
            COALESCE("r"."revenue_pennies", (0)::bigint) AS "revenue_pennies",
            COALESCE("e"."lesson_minutes_total", (0)::bigint) AS "lesson_minutes_total",
            COALESCE("e"."snc_free_minutes", (0)::bigint) AS "snc_free_minutes",
            COALESCE("e"."snc_charged_minutes", (0)::bigint) AS "snc_charged_minutes",
            COALESCE("e"."gross_pennies", (0)::bigint) AS "teacher_earnings_pennies",
            COALESCE("x"."expenses_approved_pennies", (0)::bigint) AS "expenses_approved_pennies",
            COALESCE("x"."expenses_pending_pennies", (0)::bigint) AS "expenses_pending_pennies",
            COALESCE("x"."expenses_rejected_pennies", (0)::bigint) AS "expenses_rejected_pennies"
           FROM (("revenue" "r"
             FULL JOIN "earnings" "e" USING ("teacher_id", "month_start"))
             FULL JOIN "expenses" "x" USING ("teacher_id", "month_start"))
        )
 SELECT "teacher_id",
    "month_start",
    "revenue_pennies",
    "lesson_minutes_total",
    "snc_free_minutes",
    "snc_charged_minutes",
    "teacher_earnings_pennies",
    "expenses_approved_pennies",
    "expenses_pending_pennies",
    "expenses_rejected_pennies",
    ("revenue_pennies" - "teacher_earnings_pennies") AS "margin_before_expenses_pennies",
    (("revenue_pennies" - "teacher_earnings_pennies") - "expenses_approved_pennies") AS "margin_after_expenses_pennies",
        CASE
            WHEN ("revenue_pennies" > 0) THEN (((("revenue_pennies" - "teacher_earnings_pennies"))::numeric * 100.0) / ("revenue_pennies")::numeric)
            ELSE NULL::numeric
        END AS "margin_before_expenses_pct",
        CASE
            WHEN ("revenue_pennies" > 0) THEN ((((("revenue_pennies" - "teacher_earnings_pennies") - "expenses_approved_pennies"))::numeric * 100.0) / ("revenue_pennies")::numeric)
            ELSE NULL::numeric
        END AS "margin_after_expenses_pct"
   FROM "joined";


ALTER VIEW "public"."v_teacher_margin_by_month" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_teacher_margin_by_month_with_names" AS
 SELECT "tm"."teacher_id",
    "tm"."month_start",
    "tm"."revenue_pennies",
    "tm"."lesson_minutes_total",
    "tm"."snc_free_minutes",
    "tm"."snc_charged_minutes",
    "tm"."teacher_earnings_pennies",
    "tm"."expenses_approved_pennies",
    "tm"."expenses_pending_pennies",
    "tm"."expenses_rejected_pennies",
    "tm"."margin_before_expenses_pennies",
    "tm"."margin_after_expenses_pennies",
    "tm"."margin_before_expenses_pct",
    "tm"."margin_after_expenses_pct",
    "tn"."display_name" AS "teacher_name",
    "tn"."full_name" AS "teacher_full_name"
   FROM ("public"."v_teacher_margin_by_month" "tm"
     LEFT JOIN "public"."v_teacher_names" "tn" ON (("tn"."teacher_id" = "tm"."teacher_id")));


ALTER VIEW "public"."v_teacher_margin_by_month_with_names" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_teacher_rate_summary" AS
 WITH "override_agg" AS (
         SELECT "o"."teacher_id",
            "count"(*) AS "num_f2f_overrides",
            "min"("o"."f2f_rate_pennies") AS "min_override_rate_pennies",
            "max"("o"."f2f_rate_pennies") AS "max_override_rate_pennies"
           FROM "public"."teacher_student_f2f_overrides" "o"
          GROUP BY "o"."teacher_id"
        )
 SELECT "t"."id" AS "teacher_id",
    "tr"."default_online_rate_pennies",
    "tr"."f2f_basic_rate_pennies",
    "tr"."f2f_premium_rate_pennies",
    COALESCE("oa"."num_f2f_overrides", (0)::bigint) AS "num_f2f_overrides",
    "oa"."min_override_rate_pennies",
    "oa"."max_override_rate_pennies"
   FROM (("public"."teachers" "t"
     LEFT JOIN "public"."teacher_rates" "tr" ON (("tr"."teacher_id" = "t"."id")))
     LEFT JOIN "override_agg" "oa" ON (("oa"."teacher_id" = "t"."id")));


ALTER VIEW "public"."v_teacher_rate_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_teacher_usage_last_3m" AS
 WITH "monthly" AS (
         SELECT "l"."teacher_id",
            "date_trunc"('month'::"text", "l"."occurred_at") AS "month_start",
            ("sum"("l"."duration_min"))::integer AS "minutes_taken"
           FROM "public"."lessons" "l"
          WHERE (("l"."state" = 'confirmed'::"public"."lesson_state") AND ("l"."occurred_at" >= "date_trunc"('month'::"text", ("now"() - '3 mons'::interval))))
          GROUP BY "l"."teacher_id", ("date_trunc"('month'::"text", "l"."occurred_at"))
        ), "agg" AS (
         SELECT "m"."teacher_id",
            "count"(*) AS "months_count",
            "sum"("m"."minutes_taken") AS "minutes_last_3m",
            "avg"("m"."minutes_taken") AS "avg_month_minutes"
           FROM "monthly" "m"
          GROUP BY "m"."teacher_id"
        )
 SELECT "teacher_id",
    (COALESCE("avg_month_minutes", (0)::numeric) / 60.0) AS "avg_month_hours",
    ((COALESCE("avg_month_minutes", (0)::numeric) / 60.0) > 10.0) AS "is_heavy_user"
   FROM "agg" "a";


ALTER VIEW "public"."v_teacher_usage_last_3m" OWNER TO "postgres";


ALTER TABLE ONLY "public"."student_status_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."student_status_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."teacher_expenses" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."teacher_expenses_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."teacher_invoices" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."teacher_invoices_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."teacher_status_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."teacher_status_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."allocations"
    ADD CONSTRAINT "allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."award_reasons"
    ADD CONSTRAINT "award_reasons_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."credit_lot_events"
    ADD CONSTRAINT "credit_lot_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_lots"
    ADD CONSTRAINT "credit_lots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_write_offs"
    ADD CONSTRAINT "credit_write_offs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hazard_resolutions"
    ADD CONSTRAINT "hazard_resolutions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hazard_resolutions"
    ADD CONSTRAINT "hazard_resolutions_unique_allocation" UNIQUE ("allocation_id", "hazard_type");



ALTER TABLE ONLY "public"."hazard_resolutions"
    ADD CONSTRAINT "hazard_resolutions_unique_lesson" UNIQUE ("lesson_id", "hazard_type");



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_record_queries"
    ADD CONSTRAINT "student_record_queries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_status_events"
    ADD CONSTRAINT "student_status_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_teacher"
    ADD CONSTRAINT "student_teacher_pkey" PRIMARY KEY ("student_id", "teacher_id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."teacher_expenses"
    ADD CONSTRAINT "teacher_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_invoices"
    ADD CONSTRAINT "teacher_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_rates"
    ADD CONSTRAINT "teacher_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_status_events"
    ADD CONSTRAINT "teacher_status_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_student_f2f_overrides"
    ADD CONSTRAINT "teacher_student_f2f_overrides_pkey" PRIMARY KEY ("teacher_id", "student_id");



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."timezones"
    ADD CONSTRAINT "timezones_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."credit_lots"
    ADD CONSTRAINT "uq_credit_lots_student_source_extrefnorm" UNIQUE ("student_id", "source_type", "external_ref_norm");



ALTER TABLE ONLY "public"."teacher_rates"
    ADD CONSTRAINT "uq_teacher_rates_teacher" UNIQUE ("teacher_id");



CREATE INDEX "idx_credit_lot_events_lot_created" ON "public"."credit_lot_events" USING "btree" ("credit_lot_id", "created_at" DESC);



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_profiles_timezone" ON "public"."profiles" USING "btree" ("timezone");



CREATE INDEX "idx_student_record_queries_credit_lot_id" ON "public"."student_record_queries" USING "btree" ("credit_lot_id");



CREATE INDEX "idx_student_record_queries_lesson_id" ON "public"."student_record_queries" USING "btree" ("lesson_id");



CREATE INDEX "idx_student_record_queries_status" ON "public"."student_record_queries" USING "btree" ("status");



CREATE INDEX "idx_student_record_queries_student_id" ON "public"."student_record_queries" USING "btree" ("student_id");



CREATE INDEX "idx_student_status_events_created_at" ON "public"."student_status_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_students_status" ON "public"."students" USING "btree" ("status");



CREATE INDEX "idx_teacher_rates_teacher_id" ON "public"."teacher_rates" USING "btree" ("teacher_id");



CREATE INDEX "idx_teacher_status_events_created_at" ON "public"."teacher_status_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_teacher_student_f2f_overrides_student" ON "public"."teacher_student_f2f_overrides" USING "btree" ("student_id");



CREATE INDEX "idx_teacher_student_f2f_overrides_teacher" ON "public"."teacher_student_f2f_overrides" USING "btree" ("teacher_id");



CREATE INDEX "idx_teachers_status" ON "public"."teachers" USING "btree" ("status");



CREATE INDEX "lessons_teacher_state_occurred_idx" ON "public"."lessons" USING "btree" ("teacher_id", "state", "occurred_at");



CREATE UNIQUE INDEX "lessons_unique_teacher_student_time_delivery" ON "public"."lessons" USING "btree" ("teacher_id", "student_id", "occurred_at", "delivery");



CREATE INDEX "teacher_expenses_student_id_idx" ON "public"."teacher_expenses" USING "btree" ("student_id");



CREATE UNIQUE INDEX "teacher_invoices_teacher_month_uq" ON "public"."teacher_invoices" USING "btree" ("teacher_id", "month_start");



CREATE OR REPLACE TRIGGER "prevent_delete_allocated_credit_lot" BEFORE DELETE ON "public"."credit_lots" FOR EACH ROW EXECUTE FUNCTION "public"."trg_prevent_delete_allocated_credit_lot"();



CREATE OR REPLACE TRIGGER "prevent_delete_paid_teacher_expense" BEFORE DELETE ON "public"."teacher_expenses" FOR EACH ROW EXECUTE FUNCTION "public"."trg_block_paid_teacher_expense_delete"();



CREATE OR REPLACE TRIGGER "set_timestamp_student_record_queries" BEFORE UPDATE ON "public"."student_record_queries" FOR EACH ROW EXECUTE FUNCTION "public"."set_timestamp"();



ALTER TABLE ONLY "public"."allocations"
    ADD CONSTRAINT "allocations_credit_lot_id_fkey" FOREIGN KEY ("credit_lot_id") REFERENCES "public"."credit_lots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."allocations"
    ADD CONSTRAINT "allocations_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_lot_events"
    ADD CONSTRAINT "credit_lot_events_credit_lot_id_fkey" FOREIGN KEY ("credit_lot_id") REFERENCES "public"."credit_lots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_lots"
    ADD CONSTRAINT "credit_lots_award_reason_code_fkey" FOREIGN KEY ("award_reason_code") REFERENCES "public"."award_reasons"("code");



ALTER TABLE ONLY "public"."credit_lots"
    ADD CONSTRAINT "credit_lots_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_write_offs"
    ADD CONSTRAINT "credit_write_offs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credit_write_offs"
    ADD CONSTRAINT "credit_write_offs_credit_lot_id_fkey" FOREIGN KEY ("credit_lot_id") REFERENCES "public"."credit_lots"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credit_write_offs"
    ADD CONSTRAINT "credit_write_offs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."hazard_resolutions"
    ADD CONSTRAINT "hazard_resolutions_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "public"."allocations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hazard_resolutions"
    ADD CONSTRAINT "hazard_resolutions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hazard_resolutions"
    ADD CONSTRAINT "hazard_resolutions_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_timezone_fkey" FOREIGN KEY ("timezone") REFERENCES "public"."timezones"("code") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."student_record_queries"
    ADD CONSTRAINT "student_record_queries_admin_profile_id_fkey" FOREIGN KEY ("admin_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."student_record_queries"
    ADD CONSTRAINT "student_record_queries_credit_lot_id_fkey" FOREIGN KEY ("credit_lot_id") REFERENCES "public"."credit_lots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_record_queries"
    ADD CONSTRAINT "student_record_queries_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_record_queries"
    ADD CONSTRAINT "student_record_queries_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_status_events"
    ADD CONSTRAINT "student_status_events_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_teacher"
    ADD CONSTRAINT "student_teacher_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_teacher"
    ADD CONSTRAINT "student_teacher_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_expenses"
    ADD CONSTRAINT "teacher_expenses_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teacher_expenses"
    ADD CONSTRAINT "teacher_expenses_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id");



ALTER TABLE ONLY "public"."teacher_invoices"
    ADD CONSTRAINT "teacher_invoices_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id");



ALTER TABLE ONLY "public"."teacher_rates"
    ADD CONSTRAINT "teacher_rates_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_status_events"
    ADD CONSTRAINT "teacher_status_events_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_student_f2f_overrides"
    ADD CONSTRAINT "teacher_student_f2f_overrides_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_student_f2f_overrides"
    ADD CONSTRAINT "teacher_student_f2f_overrides_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "public"."allocations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "allocations admin write" ON "public"."allocations" TO "authenticated" USING ("public"."auth_is_admin"()) WITH CHECK ("public"."auth_is_admin"());



CREATE POLICY "allocations select" ON "public"."allocations" FOR SELECT USING (("public"."auth_is_admin"() OR (EXISTS ( SELECT 1
   FROM ("public"."lessons" "l"
     JOIN "public"."teachers" "t" ON (("t"."id" = "l"."teacher_id")))
  WHERE (("l"."id" = "allocations"."lesson_id") AND ("t"."profile_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."lessons" "l"
     JOIN "public"."students" "s" ON (("s"."id" = "l"."student_id")))
  WHERE (("l"."id" = "allocations"."lesson_id") AND ("s"."profile_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."credit_lots" "cl"
     JOIN "public"."students" "s" ON (("s"."id" = "cl"."student_id")))
  WHERE (("cl"."id" = "allocations"."credit_lot_id") AND ("s"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "any_authenticated_can_select_profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."auth_is_admin"());



ALTER TABLE "public"."award_reasons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_lot_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_lots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_lots select" ON "public"."credit_lots" FOR SELECT TO "authenticated" USING (("public"."auth_is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."students" "s"
  WHERE (("s"."id" = "credit_lots"."student_id") AND ("s"."profile_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."student_teacher" "st"
     JOIN "public"."teachers" "t" ON (("t"."id" = "st"."teacher_id")))
  WHERE (("st"."student_id" = "credit_lots"."student_id") AND ("t"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "credit_lots write admin" ON "public"."credit_lots" TO "authenticated" USING ("public"."auth_is_admin"()) WITH CHECK ("public"."auth_is_admin"());



ALTER TABLE "public"."credit_write_offs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hazard_resolutions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lessons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lessons admin write" ON "public"."lessons" TO "authenticated" USING ("public"."auth_is_admin"()) WITH CHECK ("public"."auth_is_admin"());



CREATE POLICY "lessons insert by teacher or admin" ON "public"."lessons" FOR INSERT TO "authenticated" WITH CHECK (("public"."auth_is_admin"() OR ((EXISTS ( SELECT 1
   FROM "public"."teachers" "t"
  WHERE (("t"."id" = "lessons"."teacher_id") AND ("t"."profile_id" = "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."student_teacher" "st"
  WHERE (("st"."student_id" = "lessons"."student_id") AND ("st"."teacher_id" = "lessons"."teacher_id")))))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles select for teachers" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("role" = 'student'::"text") AND ("id" IN ( SELECT "s"."profile_id"
   FROM "public"."students" "s"
  WHERE ("s"."id" IN ( SELECT "st"."student_id"
           FROM ("public"."student_teacher" "st"
             JOIN "public"."teachers" "t" ON (("t"."id" = "st"."teacher_id")))
          WHERE ("t"."profile_id" = "auth"."uid"())))))));



CREATE POLICY "profiles self read" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."auth_is_admin"()));



CREATE POLICY "profiles self update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."auth_is_admin"()));



ALTER TABLE "public"."student_record_queries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_status_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_teacher" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_teacher teachers read own" ON "public"."student_teacher" FOR SELECT TO "authenticated" USING (("teacher_id" IN ( SELECT "t"."id"
   FROM "public"."teachers" "t"
  WHERE ("t"."profile_id" = "auth"."uid"()))));



ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "students admin write" ON "public"."students" TO "authenticated" USING ("public"."auth_is_admin"()) WITH CHECK ("public"."auth_is_admin"());



CREATE POLICY "students select for teachers" ON "public"."students" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "st"."student_id"
   FROM ("public"."student_teacher" "st"
     JOIN "public"."teachers" "t" ON (("t"."id" = "st"."teacher_id")))
  WHERE ("t"."profile_id" = "auth"."uid"()))));



CREATE POLICY "students select minimal" ON "public"."students" FOR SELECT TO "authenticated" USING (("public"."auth_is_admin"() OR ("profile_id" = "auth"."uid"())));



CREATE POLICY "students_can_select_own_lessons" ON "public"."lessons" FOR SELECT TO "authenticated" USING (("student_id" IN ( SELECT "s"."id"
   FROM "public"."students" "s"
  WHERE ("s"."profile_id" = "auth"."uid"()))));



CREATE POLICY "students_insert_own_queries" ON "public"."student_record_queries" FOR INSERT TO "authenticated" WITH CHECK (("student_id" IN ( SELECT "s"."id"
   FROM "public"."students" "s"
  WHERE ("s"."profile_id" = "auth"."uid"()))));



CREATE POLICY "students_select_own_queries" ON "public"."student_record_queries" FOR SELECT TO "authenticated" USING (("student_id" IN ( SELECT "s"."id"
   FROM "public"."students" "s"
  WHERE ("s"."profile_id" = "auth"."uid"()))));



ALTER TABLE "public"."teacher_expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teacher_expenses_delete_pending_own" ON "public"."teacher_expenses" FOR DELETE TO "authenticated" USING ((("status" = 'pending'::"text") AND ("teacher_id" IN ( SELECT "t"."id"
   FROM "public"."teachers" "t"
  WHERE ("t"."profile_id" = "auth"."uid"())))));



ALTER TABLE "public"."teacher_invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teacher_invoices delete own draft" ON "public"."teacher_invoices" FOR DELETE TO "authenticated" USING ((("status" = 'draft'::"text") AND ("teacher_id" IN ( SELECT "t"."id"
   FROM "public"."teachers" "t"
  WHERE ("t"."profile_id" = "auth"."uid"())))));



CREATE POLICY "teacher_invoices insert own" ON "public"."teacher_invoices" FOR INSERT TO "authenticated" WITH CHECK (("teacher_id" IN ( SELECT "t"."id"
   FROM "public"."teachers" "t"
  WHERE ("t"."profile_id" = "auth"."uid"()))));



CREATE POLICY "teacher_invoices select own" ON "public"."teacher_invoices" FOR SELECT TO "authenticated" USING (("teacher_id" IN ( SELECT "t"."id"
   FROM "public"."teachers" "t"
  WHERE ("t"."profile_id" = "auth"."uid"()))));



ALTER TABLE "public"."teacher_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teacher_rates select own" ON "public"."teacher_rates" FOR SELECT TO "authenticated" USING (("public"."auth_is_admin"() OR ("teacher_id" IN ( SELECT "t"."id"
   FROM "public"."teachers" "t"
  WHERE ("t"."profile_id" = "auth"."uid"())))));



ALTER TABLE "public"."teacher_status_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_student_f2f_overrides" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teacher_student_f2f_overrides select own" ON "public"."teacher_student_f2f_overrides" FOR SELECT TO "authenticated" USING (("teacher_id" IN ( SELECT "t"."id"
   FROM "public"."teachers" "t"
  WHERE ("t"."profile_id" = "auth"."uid"()))));



ALTER TABLE "public"."teachers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teachers read own or admin" ON "public"."teachers" FOR SELECT TO "authenticated" USING ((("profile_id" = "auth"."uid"()) OR "public"."auth_is_admin"()));



CREATE POLICY "teachers_can_delete_own_pending_lessons" ON "public"."lessons" FOR DELETE TO "authenticated" USING ((("teacher_id" IN ( SELECT "t"."id"
   FROM "public"."teachers" "t"
  WHERE ("t"."profile_id" = "auth"."uid"()))) AND ("state" = 'pending'::"public"."lesson_state")));



CREATE POLICY "teachers_can_insert_own_expenses" ON "public"."teacher_expenses" FOR INSERT TO "authenticated" WITH CHECK (("teacher_id" IN ( SELECT "t"."id"
   FROM "public"."teachers" "t"
  WHERE ("t"."profile_id" = "auth"."uid"()))));



CREATE POLICY "teachers_can_select_own_expenses" ON "public"."teacher_expenses" FOR SELECT TO "authenticated" USING (("teacher_id" IN ( SELECT "t"."id"
   FROM "public"."teachers" "t"
  WHERE ("t"."profile_id" = "auth"."uid"()))));



CREATE POLICY "teachers_can_select_own_lessons" ON "public"."lessons" FOR SELECT TO "authenticated" USING (("teacher_id" IN ( SELECT "t"."id"
   FROM "public"."teachers" "t"
  WHERE ("t"."profile_id" = "auth"."uid"()))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_delivery_hazard_type"("p_lesson_delivery" "public"."delivery", "p_lot_delivery_restriction" "public"."delivery") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_delivery_hazard_type"("p_lesson_delivery" "public"."delivery", "p_lot_delivery_restriction" "public"."delivery") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_delivery_hazard_type"("p_lesson_delivery" "public"."delivery", "p_lot_delivery_restriction" "public"."delivery") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_get_overdraft_deficit"("p_student_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_get_overdraft_deficit"("p_student_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_get_overdraft_deficit"("p_student_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_is_delivery_mismatch"("p_lesson_delivery" "public"."delivery", "p_lot_delivery_restriction" "public"."delivery") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_is_delivery_mismatch"("p_lesson_delivery" "public"."delivery", "p_lot_delivery_restriction" "public"."delivery") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_delivery_mismatch"("p_lesson_delivery" "public"."delivery", "p_lot_delivery_restriction" "public"."delivery") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_is_dynamic_low"("remaining_hours" numeric, "avg_month_hours" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_is_dynamic_low"("remaining_hours" numeric, "avg_month_hours" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_dynamic_low"("remaining_hours" numeric, "avg_month_hours" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_is_generic_low_credit"("remaining_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_is_generic_low_credit"("remaining_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_generic_low_credit"("remaining_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_is_heavy_user"("avg_month_minutes" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_is_heavy_user"("avg_month_minutes" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_heavy_user"("avg_month_minutes" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_is_length_restriction_mismatch"("p_lot_length" "public"."length_cat", "p_duration_min" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_is_length_restriction_mismatch"("p_lot_length" "public"."length_cat", "p_duration_min" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_length_restriction_mismatch"("p_lot_length" "public"."length_cat", "p_duration_min" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_is_length_too_short"("p_length_cat" "public"."length_cat", "p_duration_min" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_is_length_too_short"("p_length_cat" "public"."length_cat", "p_duration_min" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_length_too_short"("p_length_cat" "public"."length_cat", "p_duration_min" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_is_snc_lesson"("is_snc" boolean, "lesson_state" "public"."lesson_state") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_is_snc_lesson"("is_snc" boolean, "lesson_state" "public"."lesson_state") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_snc_lesson"("is_snc" boolean, "lesson_state" "public"."lesson_state") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_is_snc_overuse"("snc_count" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_is_snc_overuse"("snc_count" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_snc_overuse"("snc_count" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_length_threshold"("p_length_cat" "public"."length_cat") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_length_threshold"("p_length_cat" "public"."length_cat") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_length_threshold"("p_length_cat" "public"."length_cat") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_plan_lesson_allocation"("p_lesson_id" "uuid", "p_admin_override" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_plan_lesson_allocation"("p_lesson_id" "uuid", "p_admin_override" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_plan_lesson_allocation"("p_lesson_id" "uuid", "p_admin_override" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_settle_overdraft_common"("p_student_id" "uuid", "p_mode" "text", "p_award_reason_code" "text", "p_invoice_ref" "text", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_settle_overdraft_common"("p_student_id" "uuid", "p_mode" "text", "p_award_reason_code" "text", "p_invoice_ref" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_settle_overdraft_common"("p_student_id" "uuid", "p_mode" "text", "p_award_reason_code" "text", "p_invoice_ref" "text", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_write_off_overdraft_common"("p_student_id" "uuid", "p_reason_code" "public"."credit_write_off_reason", "p_note" "text", "p_accounting_period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_write_off_overdraft_common"("p_student_id" "uuid", "p_reason_code" "public"."credit_write_off_reason", "p_note" "text", "p_accounting_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_write_off_overdraft_common"("p_student_id" "uuid", "p_reason_code" "public"."credit_write_off_reason", "p_note" "text", "p_accounting_period" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_overdraft_lot"("p_student_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_overdraft_lot"("p_student_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_overdraft_lot"("p_student_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_current_student"("s_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_current_student"("s_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_student"("s_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_teacher_assigned_to_student"("s_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_teacher_assigned_to_student"("s_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_teacher_assigned_to_student"("s_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_student_record_queries_seen"("p_query_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."mark_student_record_queries_seen"("p_query_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_student_record_queries_seen"("p_query_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_admin_assign_student_teacher"("p_student_id" "uuid", "p_teacher_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_admin_assign_student_teacher"("p_student_id" "uuid", "p_teacher_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_admin_assign_student_teacher"("p_student_id" "uuid", "p_teacher_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_admin_create_student"("p_auth_user_id" "uuid", "p_full_name" "text", "p_preferred_name" "text", "p_timezone" "text", "p_tier" "public"."tier", "p_teacher_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_admin_create_student"("p_auth_user_id" "uuid", "p_full_name" "text", "p_preferred_name" "text", "p_timezone" "text", "p_tier" "public"."tier", "p_teacher_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_admin_create_student"("p_auth_user_id" "uuid", "p_full_name" "text", "p_preferred_name" "text", "p_timezone" "text", "p_tier" "public"."tier", "p_teacher_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_admin_unassign_student_teacher"("p_student_id" "uuid", "p_teacher_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_admin_unassign_student_teacher"("p_student_id" "uuid", "p_teacher_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_admin_unassign_student_teacher"("p_student_id" "uuid", "p_teacher_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_auto_dormant_students"("p_inactive_interval" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_auto_dormant_students"("p_inactive_interval" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_auto_dormant_students"("p_inactive_interval" interval) TO "service_role";



GRANT ALL ON TABLE "public"."credit_lots" TO "anon";
GRANT ALL ON TABLE "public"."credit_lots" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_lots" TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_award_minutes"("p_student_id" "uuid", "p_minutes_granted" integer, "p_start_date" "date", "p_award_reason_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_award_minutes"("p_student_id" "uuid", "p_minutes_granted" integer, "p_start_date" "date", "p_award_reason_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_award_minutes"("p_student_id" "uuid", "p_minutes_granted" integer, "p_start_date" "date", "p_award_reason_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_award_overdraft"("p_student_id" "uuid", "p_award_reason_code" "text", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_award_overdraft"("p_student_id" "uuid", "p_award_reason_code" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_award_overdraft"("p_student_id" "uuid", "p_award_reason_code" "text", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_cleanup_past_students_lessons"("p_min_age" interval, "p_dry_run" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_cleanup_past_students_lessons"("p_min_age" interval, "p_dry_run" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_cleanup_past_students_lessons"("p_min_age" interval, "p_dry_run" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_confirm_lesson"("p_lesson_id" "uuid", "p_admin_override" boolean, "p_override_reason" "text", "p_reallocate" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_confirm_lesson"("p_lesson_id" "uuid", "p_admin_override" boolean, "p_override_reason" "text", "p_reallocate" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_confirm_lesson"("p_lesson_id" "uuid", "p_admin_override" boolean, "p_override_reason" "text", "p_reallocate" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_decline_lesson"("p_lesson_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_decline_lesson"("p_lesson_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_decline_lesson"("p_lesson_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_import_invoice"("p_student_id" "uuid", "p_external_ref" "text", "p_minutes_granted" integer, "p_start_date" "date", "p_delivery_restriction" "text", "p_tier_restriction" "text", "p_length_restriction" "text", "p_expiry_policy" "text", "p_expiry_date" "date", "p_lessons_per_month" integer, "p_duration_per_lesson_mins" integer, "p_buffer" numeric, "p_amount_pennies" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_import_invoice"("p_student_id" "uuid", "p_external_ref" "text", "p_minutes_granted" integer, "p_start_date" "date", "p_delivery_restriction" "text", "p_tier_restriction" "text", "p_length_restriction" "text", "p_expiry_policy" "text", "p_expiry_date" "date", "p_lessons_per_month" integer, "p_duration_per_lesson_mins" integer, "p_buffer" numeric, "p_amount_pennies" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_import_invoice"("p_student_id" "uuid", "p_external_ref" "text", "p_minutes_granted" integer, "p_start_date" "date", "p_delivery_restriction" "text", "p_tier_restriction" "text", "p_length_restriction" "text", "p_expiry_policy" "text", "p_expiry_date" "date", "p_lessons_per_month" integer, "p_duration_per_lesson_mins" integer, "p_buffer" numeric, "p_amount_pennies" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_invoice_overdraft"("p_student_id" "uuid", "p_invoice_ref" "text", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_invoice_overdraft"("p_student_id" "uuid", "p_invoice_ref" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_invoice_overdraft"("p_student_id" "uuid", "p_invoice_ref" "text", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_log_lesson"("p_student_id" "uuid", "p_occurred_at" timestamp with time zone, "p_duration_min" integer, "p_delivery" "public"."delivery", "p_is_snc" boolean, "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_log_lesson"("p_student_id" "uuid", "p_occurred_at" timestamp with time zone, "p_duration_min" integer, "p_delivery" "public"."delivery", "p_is_snc" boolean, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_log_lesson"("p_student_id" "uuid", "p_occurred_at" timestamp with time zone, "p_duration_min" integer, "p_delivery" "public"."delivery", "p_is_snc" boolean, "p_notes" "text") TO "service_role";



GRANT ALL ON TABLE "public"."teacher_expenses" TO "anon";
GRANT ALL ON TABLE "public"."teacher_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_expenses" TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_log_teacher_expense"("p_incurred_at" timestamp with time zone, "p_amount_pennies" integer, "p_category" "text", "p_description" "text", "p_student_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_log_teacher_expense"("p_incurred_at" timestamp with time zone, "p_amount_pennies" integer, "p_category" "text", "p_description" "text", "p_student_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_log_teacher_expense"("p_incurred_at" timestamp with time zone, "p_amount_pennies" integer, "p_category" "text", "p_description" "text", "p_student_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_mark_students_dormant"("p_inactive_interval" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_mark_students_dormant"("p_inactive_interval" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_mark_students_dormant"("p_inactive_interval" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_preview_lesson_allocation"("p_lesson_id" "uuid", "p_admin_override" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_preview_lesson_allocation"("p_lesson_id" "uuid", "p_admin_override" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_preview_lesson_allocation"("p_lesson_id" "uuid", "p_admin_override" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_refresh_teacher_statuses"() TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_refresh_teacher_statuses"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_refresh_teacher_statuses"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_resolve_hazard"("p_hazard_type" "text", "p_lesson_id" "uuid", "p_allocation_id" "uuid", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_resolve_hazard"("p_hazard_type" "text", "p_lesson_id" "uuid", "p_allocation_id" "uuid", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_resolve_hazard"("p_hazard_type" "text", "p_lesson_id" "uuid", "p_allocation_id" "uuid", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_update_invoice_lot_minutes"("p_credit_lot_id" "uuid", "p_new_minutes_granted" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_update_invoice_lot_minutes"("p_credit_lot_id" "uuid", "p_new_minutes_granted" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_update_invoice_lot_minutes"("p_credit_lot_id" "uuid", "p_new_minutes_granted" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_write_off_overdraft"("p_student_id" "uuid", "p_reason_code" "text", "p_note" "text", "p_accounting_period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_write_off_overdraft"("p_student_id" "uuid", "p_reason_code" "text", "p_note" "text", "p_accounting_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_write_off_overdraft"("p_student_id" "uuid", "p_reason_code" "text", "p_note" "text", "p_accounting_period" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_write_off_overdraft_credit"("p_student_id" "uuid", "p_reason_code" "public"."credit_write_off_reason", "p_note" "text", "p_accounting_period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_write_off_overdraft_credit"("p_student_id" "uuid", "p_reason_code" "public"."credit_write_off_reason", "p_note" "text", "p_accounting_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_write_off_overdraft_credit"("p_student_id" "uuid", "p_reason_code" "public"."credit_write_off_reason", "p_note" "text", "p_accounting_period" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_write_off_remaining_credit"("p_student_id" "uuid", "p_reason_code" "public"."credit_write_off_reason", "p_note" "text", "p_accounting_period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_write_off_remaining_credit"("p_student_id" "uuid", "p_reason_code" "public"."credit_write_off_reason", "p_note" "text", "p_accounting_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_write_off_remaining_credit"("p_student_id" "uuid", "p_reason_code" "public"."credit_write_off_reason", "p_note" "text", "p_accounting_period" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_block_paid_teacher_expense_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_block_paid_teacher_expense_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_block_paid_teacher_expense_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_prevent_delete_allocated_credit_lot"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_prevent_delete_allocated_credit_lot"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_prevent_delete_allocated_credit_lot"() TO "service_role";



GRANT ALL ON TABLE "public"."allocations" TO "anon";
GRANT ALL ON TABLE "public"."allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."allocations" TO "service_role";



GRANT ALL ON TABLE "public"."award_reasons" TO "anon";
GRANT ALL ON TABLE "public"."award_reasons" TO "authenticated";
GRANT ALL ON TABLE "public"."award_reasons" TO "service_role";



GRANT ALL ON TABLE "public"."credit_lot_events" TO "anon";
GRANT ALL ON TABLE "public"."credit_lot_events" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_lot_events" TO "service_role";



GRANT ALL ON TABLE "public"."credit_write_offs" TO "anon";
GRANT ALL ON TABLE "public"."credit_write_offs" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_write_offs" TO "service_role";



GRANT ALL ON TABLE "public"."hazard_resolutions" TO "anon";
GRANT ALL ON TABLE "public"."hazard_resolutions" TO "authenticated";
GRANT ALL ON TABLE "public"."hazard_resolutions" TO "service_role";



GRANT ALL ON TABLE "public"."lessons" TO "anon";
GRANT ALL ON TABLE "public"."lessons" TO "authenticated";
GRANT ALL ON TABLE "public"."lessons" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."student_record_queries" TO "anon";
GRANT ALL ON TABLE "public"."student_record_queries" TO "authenticated";
GRANT ALL ON TABLE "public"."student_record_queries" TO "service_role";



GRANT ALL ON TABLE "public"."student_status_events" TO "anon";
GRANT ALL ON TABLE "public"."student_status_events" TO "authenticated";
GRANT ALL ON TABLE "public"."student_status_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."student_status_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."student_status_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."student_status_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."student_teacher" TO "anon";
GRANT ALL ON TABLE "public"."student_teacher" TO "authenticated";
GRANT ALL ON TABLE "public"."student_teacher" TO "service_role";



GRANT ALL ON TABLE "public"."students" TO "anon";
GRANT ALL ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";



GRANT ALL ON SEQUENCE "public"."teacher_expenses_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."teacher_expenses_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."teacher_expenses_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_invoices" TO "anon";
GRANT ALL ON TABLE "public"."teacher_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_invoices" TO "service_role";



GRANT ALL ON SEQUENCE "public"."teacher_invoices_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."teacher_invoices_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."teacher_invoices_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_rates" TO "anon";
GRANT ALL ON TABLE "public"."teacher_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_rates" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_status_events" TO "anon";
GRANT ALL ON TABLE "public"."teacher_status_events" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_status_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."teacher_status_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."teacher_status_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."teacher_status_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_student_f2f_overrides" TO "anon";
GRANT ALL ON TABLE "public"."teacher_student_f2f_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_student_f2f_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."teachers" TO "anon";
GRANT ALL ON TABLE "public"."teachers" TO "authenticated";
GRANT ALL ON TABLE "public"."teachers" TO "service_role";



GRANT ALL ON TABLE "public"."timezones" TO "anon";
GRANT ALL ON TABLE "public"."timezones" TO "authenticated";
GRANT ALL ON TABLE "public"."timezones" TO "service_role";



GRANT ALL ON TABLE "public"."v_allocation_delivery_hazards_raw" TO "anon";
GRANT ALL ON TABLE "public"."v_allocation_delivery_hazards_raw" TO "authenticated";
GRANT ALL ON TABLE "public"."v_allocation_delivery_hazards_raw" TO "service_role";



GRANT ALL ON TABLE "public"."v_allocation_delivery_hazards" TO "anon";
GRANT ALL ON TABLE "public"."v_allocation_delivery_hazards" TO "authenticated";
GRANT ALL ON TABLE "public"."v_allocation_delivery_hazards" TO "service_role";



GRANT ALL ON TABLE "public"."v_allocation_length_restriction_hazards_raw" TO "anon";
GRANT ALL ON TABLE "public"."v_allocation_length_restriction_hazards_raw" TO "authenticated";
GRANT ALL ON TABLE "public"."v_allocation_length_restriction_hazards_raw" TO "service_role";



GRANT ALL ON TABLE "public"."v_allocation_length_restriction_hazards" TO "anon";
GRANT ALL ON TABLE "public"."v_allocation_length_restriction_hazards" TO "authenticated";
GRANT ALL ON TABLE "public"."v_allocation_length_restriction_hazards" TO "service_role";



GRANT ALL ON TABLE "public"."v_student_names" TO "anon";
GRANT ALL ON TABLE "public"."v_student_names" TO "authenticated";
GRANT ALL ON TABLE "public"."v_student_names" TO "service_role";



GRANT ALL ON TABLE "public"."v_credit_expiry_by_month" TO "anon";
GRANT ALL ON TABLE "public"."v_credit_expiry_by_month" TO "authenticated";
GRANT ALL ON TABLE "public"."v_credit_expiry_by_month" TO "service_role";



GRANT ALL ON TABLE "public"."v_credit_lot_remaining" TO "anon";
GRANT ALL ON TABLE "public"."v_credit_lot_remaining" TO "authenticated";
GRANT ALL ON TABLE "public"."v_credit_lot_remaining" TO "service_role";



GRANT ALL ON TABLE "public"."v_lesson_length_hazards_raw" TO "anon";
GRANT ALL ON TABLE "public"."v_lesson_length_hazards_raw" TO "authenticated";
GRANT ALL ON TABLE "public"."v_lesson_length_hazards_raw" TO "service_role";



GRANT ALL ON TABLE "public"."v_lesson_length_hazards" TO "anon";
GRANT ALL ON TABLE "public"."v_lesson_length_hazards" TO "authenticated";
GRANT ALL ON TABLE "public"."v_lesson_length_hazards" TO "service_role";



GRANT ALL ON TABLE "public"."v_overdraft_allocation_hazards" TO "anon";
GRANT ALL ON TABLE "public"."v_overdraft_allocation_hazards" TO "authenticated";
GRANT ALL ON TABLE "public"."v_overdraft_allocation_hazards" TO "service_role";



GRANT ALL ON TABLE "public"."v_snc_overuse_hazards_raw" TO "anon";
GRANT ALL ON TABLE "public"."v_snc_overuse_hazards_raw" TO "authenticated";
GRANT ALL ON TABLE "public"."v_snc_overuse_hazards_raw" TO "service_role";



GRANT ALL ON TABLE "public"."v_snc_overuse_hazards" TO "anon";
GRANT ALL ON TABLE "public"."v_snc_overuse_hazards" TO "authenticated";
GRANT ALL ON TABLE "public"."v_snc_overuse_hazards" TO "service_role";



GRANT ALL ON TABLE "public"."v_lesson_hazards" TO "anon";
GRANT ALL ON TABLE "public"."v_lesson_hazards" TO "authenticated";
GRANT ALL ON TABLE "public"."v_lesson_hazards" TO "service_role";



GRANT ALL ON TABLE "public"."v_lesson_revenue_detail" TO "anon";
GRANT ALL ON TABLE "public"."v_lesson_revenue_detail" TO "authenticated";
GRANT ALL ON TABLE "public"."v_lesson_revenue_detail" TO "service_role";



GRANT ALL ON TABLE "public"."v_student_teacher_rate_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_student_teacher_rate_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_student_teacher_rate_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_teacher_lesson_earnings_detail" TO "anon";
GRANT ALL ON TABLE "public"."v_teacher_lesson_earnings_detail" TO "authenticated";
GRANT ALL ON TABLE "public"."v_teacher_lesson_earnings_detail" TO "service_role";



GRANT ALL ON TABLE "public"."v_lesson_margin_detail" TO "anon";
GRANT ALL ON TABLE "public"."v_lesson_margin_detail" TO "authenticated";
GRANT ALL ON TABLE "public"."v_lesson_margin_detail" TO "service_role";



GRANT ALL ON TABLE "public"."v_teacher_drinks_expenses_by_student_month" TO "anon";
GRANT ALL ON TABLE "public"."v_teacher_drinks_expenses_by_student_month" TO "authenticated";
GRANT ALL ON TABLE "public"."v_teacher_drinks_expenses_by_student_month" TO "service_role";



GRANT ALL ON TABLE "public"."v_lesson_margin_with_drinks_detail" TO "anon";
GRANT ALL ON TABLE "public"."v_lesson_margin_with_drinks_detail" TO "authenticated";
GRANT ALL ON TABLE "public"."v_lesson_margin_with_drinks_detail" TO "service_role";



GRANT ALL ON TABLE "public"."v_teacher_names" TO "anon";
GRANT ALL ON TABLE "public"."v_teacher_names" TO "authenticated";
GRANT ALL ON TABLE "public"."v_teacher_names" TO "service_role";



GRANT ALL ON TABLE "public"."v_lesson_margin_with_drinks_with_names" TO "anon";
GRANT ALL ON TABLE "public"."v_lesson_margin_with_drinks_with_names" TO "authenticated";
GRANT ALL ON TABLE "public"."v_lesson_margin_with_drinks_with_names" TO "service_role";



GRANT ALL ON TABLE "public"."v_lot_allocations_detail" TO "anon";
GRANT ALL ON TABLE "public"."v_lot_allocations_detail" TO "authenticated";
GRANT ALL ON TABLE "public"."v_lot_allocations_detail" TO "service_role";



GRANT ALL ON TABLE "public"."v_student_last_activity" TO "anon";
GRANT ALL ON TABLE "public"."v_student_last_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."v_student_last_activity" TO "service_role";



GRANT ALL ON TABLE "public"."v_past_students_cleanup_candidates" TO "anon";
GRANT ALL ON TABLE "public"."v_past_students_cleanup_candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."v_past_students_cleanup_candidates" TO "service_role";



GRANT ALL ON TABLE "public"."v_snc_stats_by_month" TO "anon";
GRANT ALL ON TABLE "public"."v_snc_stats_by_month" TO "authenticated";
GRANT ALL ON TABLE "public"."v_snc_stats_by_month" TO "service_role";



GRANT ALL ON TABLE "public"."v_snc_stats_by_month_with_names" TO "anon";
GRANT ALL ON TABLE "public"."v_snc_stats_by_month_with_names" TO "authenticated";
GRANT ALL ON TABLE "public"."v_snc_stats_by_month_with_names" TO "service_role";



GRANT ALL ON TABLE "public"."v_student_award_reason_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_student_award_reason_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_student_award_reason_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_student_cohort_base" TO "anon";
GRANT ALL ON TABLE "public"."v_student_cohort_base" TO "authenticated";
GRANT ALL ON TABLE "public"."v_student_cohort_base" TO "service_role";



GRANT ALL ON TABLE "public"."v_student_cohort_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_student_cohort_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_student_cohort_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_student_credit_delivery_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_student_credit_delivery_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_student_credit_delivery_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_student_credit_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_student_credit_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_student_credit_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_student_usage_last_3m" TO "anon";
GRANT ALL ON TABLE "public"."v_student_usage_last_3m" TO "authenticated";
GRANT ALL ON TABLE "public"."v_student_usage_last_3m" TO "service_role";



GRANT ALL ON TABLE "public"."v_student_dynamic_credit_alerts" TO "anon";
GRANT ALL ON TABLE "public"."v_student_dynamic_credit_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."v_student_dynamic_credit_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."v_student_dynamic_credit_alerts_by_delivery" TO "anon";
GRANT ALL ON TABLE "public"."v_student_dynamic_credit_alerts_by_delivery" TO "authenticated";
GRANT ALL ON TABLE "public"."v_student_dynamic_credit_alerts_by_delivery" TO "service_role";



GRANT ALL ON TABLE "public"."v_student_lessons" TO "anon";
GRANT ALL ON TABLE "public"."v_student_lessons" TO "authenticated";
GRANT ALL ON TABLE "public"."v_student_lessons" TO "service_role";



GRANT ALL ON TABLE "public"."v_student_lifecycle_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_student_lifecycle_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_student_lifecycle_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_student_snc_lessons" TO "anon";
GRANT ALL ON TABLE "public"."v_student_snc_lessons" TO "authenticated";
GRANT ALL ON TABLE "public"."v_student_snc_lessons" TO "service_role";



GRANT ALL ON TABLE "public"."v_student_snc_status_by_month" TO "anon";
GRANT ALL ON TABLE "public"."v_student_snc_status_by_month" TO "authenticated";
GRANT ALL ON TABLE "public"."v_student_snc_status_by_month" TO "service_role";



GRANT ALL ON TABLE "public"."v_student_snc_status_previous_month" TO "anon";
GRANT ALL ON TABLE "public"."v_student_snc_status_previous_month" TO "authenticated";
GRANT ALL ON TABLE "public"."v_student_snc_status_previous_month" TO "service_role";



GRANT ALL ON TABLE "public"."v_teacher_expenses_detail_by_month" TO "anon";
GRANT ALL ON TABLE "public"."v_teacher_expenses_detail_by_month" TO "authenticated";
GRANT ALL ON TABLE "public"."v_teacher_expenses_detail_by_month" TO "service_role";



GRANT ALL ON TABLE "public"."v_teacher_expenses_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_teacher_expenses_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_teacher_expenses_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_teacher_lesson_earnings_by_month" TO "anon";
GRANT ALL ON TABLE "public"."v_teacher_lesson_earnings_by_month" TO "authenticated";
GRANT ALL ON TABLE "public"."v_teacher_lesson_earnings_by_month" TO "service_role";



GRANT ALL ON TABLE "public"."v_teacher_invoice_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_teacher_invoice_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_teacher_invoice_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_teacher_last_activity" TO "anon";
GRANT ALL ON TABLE "public"."v_teacher_last_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."v_teacher_last_activity" TO "service_role";



GRANT ALL ON TABLE "public"."v_teacher_lesson_earnings_by_student_month" TO "anon";
GRANT ALL ON TABLE "public"."v_teacher_lesson_earnings_by_student_month" TO "authenticated";
GRANT ALL ON TABLE "public"."v_teacher_lesson_earnings_by_student_month" TO "service_role";



GRANT ALL ON TABLE "public"."v_teacher_lesson_earnings_last_month" TO "anon";
GRANT ALL ON TABLE "public"."v_teacher_lesson_earnings_last_month" TO "authenticated";
GRANT ALL ON TABLE "public"."v_teacher_lesson_earnings_last_month" TO "service_role";



GRANT ALL ON TABLE "public"."v_teacher_lesson_margin_by_student_month" TO "anon";
GRANT ALL ON TABLE "public"."v_teacher_lesson_margin_by_student_month" TO "authenticated";
GRANT ALL ON TABLE "public"."v_teacher_lesson_margin_by_student_month" TO "service_role";



GRANT ALL ON TABLE "public"."v_teacher_lesson_revenue_by_month" TO "anon";
GRANT ALL ON TABLE "public"."v_teacher_lesson_revenue_by_month" TO "authenticated";
GRANT ALL ON TABLE "public"."v_teacher_lesson_revenue_by_month" TO "service_role";



GRANT ALL ON TABLE "public"."v_teacher_lesson_stats_by_month" TO "anon";
GRANT ALL ON TABLE "public"."v_teacher_lesson_stats_by_month" TO "authenticated";
GRANT ALL ON TABLE "public"."v_teacher_lesson_stats_by_month" TO "service_role";



GRANT ALL ON TABLE "public"."v_teacher_lessons" TO "anon";
GRANT ALL ON TABLE "public"."v_teacher_lessons" TO "authenticated";
GRANT ALL ON TABLE "public"."v_teacher_lessons" TO "service_role";



GRANT ALL ON TABLE "public"."v_teacher_margin_by_month" TO "anon";
GRANT ALL ON TABLE "public"."v_teacher_margin_by_month" TO "authenticated";
GRANT ALL ON TABLE "public"."v_teacher_margin_by_month" TO "service_role";



GRANT ALL ON TABLE "public"."v_teacher_margin_by_month_with_names" TO "anon";
GRANT ALL ON TABLE "public"."v_teacher_margin_by_month_with_names" TO "authenticated";
GRANT ALL ON TABLE "public"."v_teacher_margin_by_month_with_names" TO "service_role";



GRANT ALL ON TABLE "public"."v_teacher_rate_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_teacher_rate_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_teacher_rate_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_teacher_usage_last_3m" TO "anon";
GRANT ALL ON TABLE "public"."v_teacher_usage_last_3m" TO "authenticated";
GRANT ALL ON TABLE "public"."v_teacher_usage_last_3m" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







