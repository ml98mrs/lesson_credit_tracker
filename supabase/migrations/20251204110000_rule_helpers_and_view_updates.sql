-- 20251204_rule_helpers_and_view_updates.sql
-- Centralise business rules (low credit, dynamic buffer, heavy user, SNC rules)
-- and update dependent views to use helper functions.

------------------------------------------------------------
-- 1. Helper functions (single source of truth)
------------------------------------------------------------

-- Generic low credit threshold (default 360 min = 6 hours)
create or replace function fn_is_generic_low_credit(remaining_minutes int)
returns boolean
language sql
immutable
as $$
    select remaining_minutes <= 360;
$$;


-- Dynamic low buffer threshold (default 4 hours)
create or replace function fn_is_dynamic_low(
    remaining_hours numeric,
    avg_month_hours numeric
)
returns boolean
language sql
immutable
as $$
    select avg_month_hours is not null
       and avg_month_hours > 0
       and (remaining_hours - avg_month_hours) < 4.0;
$$;


-- Heavy user threshold (default 12 hours / month)
create or replace function fn_is_heavy_user(avg_month_minutes numeric)
returns boolean
language sql
immutable
as $$
    -- 12 * 60 minutes
    select avg_month_minutes >= 720;
$$;


-- Canonical SNC eligibility: SNC + confirmed lesson
create or replace function fn_is_snc_lesson(
    is_snc boolean,
    lesson_state lesson_state
)
returns boolean
language sql
immutable
as $$
    select is_snc = true and lesson_state = 'confirmed';
$$;


-- SNC overuse threshold (default: more than 3 SNCs in a month)
create or replace function fn_is_snc_overuse(snc_count bigint)
returns boolean
language sql
immutable
as $$
    select snc_count > 3;
$$;


------------------------------------------------------------
-- 2. Updated views using helper functions
------------------------------------------------------------

-------------------------------
-- v_student_credit_summary
-------------------------------
create or replace view public.v_student_credit_summary as
with s as (
    select
      v.student_id,
      coalesce(sum(v.minutes_granted),   0::bigint)::integer as total_granted_min,
      coalesce(sum(v.minutes_allocated), 0::bigint)::integer as total_allocated_min,
      coalesce(sum(v.minutes_remaining), 0::bigint)::integer as total_remaining_min,
      min(
        case
          when v.expiry_date is not null
           and v.expiry_date >= current_date
            then v.expiry_date
          else null::date
        end
      ) as next_expiry_date
    from v_credit_lot_remaining v
    group by v.student_id
)
select
  st.id                                           as student_id,
  coalesce(s.total_granted_min,   0)              as total_granted_min,
  coalesce(s.total_allocated_min, 0)              as total_allocated_min,
  coalesce(s.total_remaining_min, 0)              as total_remaining_min,
  fn_is_generic_low_credit(coalesce(s.total_remaining_min, 0)) as low_credit,
  s.next_expiry_date,
  case
    when s.next_expiry_date is null then null::integer
    else s.next_expiry_date - current_date
  end                                             as days_to_next_expiry,
  case
    when s.next_expiry_date is null then false
    else s.next_expiry_date <= (current_date + 30)
  end                                             as expiry_within_30d
from students st
left join s
  on s.student_id = st.id;


-------------------------------
-- v_student_dynamic_credit_alerts
-------------------------------
create or replace view public.v_student_dynamic_credit_alerts as
select
  cs.student_id,
  cs.total_remaining_min                         as remaining_minutes,
  cs.total_remaining_min::numeric / 60.0         as remaining_hours,
  u.avg_month_hours,
  cs.total_remaining_min::numeric / 60.0
    - coalesce(u.avg_month_hours, 0::numeric)    as buffer_hours,
  fn_is_generic_low_credit(cs.total_remaining_min) as is_generic_low,
  fn_is_dynamic_low(
    cs.total_remaining_min::numeric / 60.0,
    u.avg_month_hours
  )                                              as is_dynamic_low,
  fn_is_generic_low_credit(cs.total_remaining_min)
    or fn_is_dynamic_low(
      cs.total_remaining_min::numeric / 60.0,
      u.avg_month_hours
    )                                            as is_low_any
from v_student_credit_summary cs
join students s
  on s.id = cs.student_id
 and s.status <> 'past'::student_status
left join v_student_usage_last_3m u
  on u.student_id = cs.student_id;


-------------------------------
-- v_student_dynamic_credit_alerts_by_delivery
-------------------------------
create or replace view public.v_student_dynamic_credit_alerts_by_delivery as
with purchased_by_delivery as (
    select
      s.student_id,
      'online'::delivery  as delivery,
      s.purchased_online_min as purchased_minutes
    from v_student_credit_delivery_summary s
    where s.purchased_online_min > 0

    union all

    select
      s.student_id,
      'f2f'::delivery     as delivery,
      s.purchased_f2f_min as purchased_minutes
    from v_student_credit_delivery_summary s
    where s.purchased_f2f_min > 0
),
remaining_by_delivery as (
    select
      v.student_id,
      v.delivery_restriction         as delivery,
      sum(v.minutes_remaining)::int  as remaining_minutes
    from v_credit_lot_remaining v
    join students s
      on s.id = v.student_id
     and s.status <> 'past'::student_status
    where v.source_type = 'invoice'::text
      and v.state       = 'open'::credit_lot_state
      and (v.expiry_date is null or v.expiry_date >= current_date)
      and v.delivery_restriction = any (array['online'::delivery, 'f2f'::delivery])
    group by v.student_id, v.delivery_restriction
),
monthly_by_delivery as (
    select
      l.student_id,
      l.delivery,
      date_trunc('month', l.occurred_at) as month_start,
      sum(l.duration_min)                as minutes_taken
    from lessons l
    where l.state = 'confirmed'::lesson_state
      and l.delivery = any (array['online'::delivery, 'f2f'::delivery])
      and l.occurred_at >= date_trunc('month', now() - interval '3 mons')
    group by
      l.student_id,
      l.delivery,
      date_trunc('month', l.occurred_at)
),
usage_by_delivery as (
    select
      m.student_id,
      m.delivery,
      count(*)             as months_count,
      sum(m.minutes_taken) as minutes_last_3m,
      avg(m.minutes_taken) as avg_month_minutes
    from monthly_by_delivery m
    group by m.student_id, m.delivery
),
base as (
    select
      p.student_id,
      p.delivery,
      p.purchased_minutes,
      coalesce(r.remaining_minutes, 0) as remaining_minutes
    from purchased_by_delivery p
    left join remaining_by_delivery r
      on r.student_id = p.student_id
     and r.delivery   = p.delivery
)
select
  b.student_id,
  b.delivery,
  b.remaining_minutes,
  b.remaining_minutes::numeric / 60.0               as remaining_hours,
  u.avg_month_minutes / 60.0                        as avg_month_hours,
  b.remaining_minutes::numeric / 60.0
    - coalesce(u.avg_month_minutes / 60.0, 0.0)     as buffer_hours,
  fn_is_generic_low_credit(b.remaining_minutes)     as is_generic_low,
  fn_is_dynamic_low(
    b.remaining_minutes::numeric / 60.0,
    u.avg_month_minutes / 60.0
  )                                                 as is_dynamic_low,
  b.remaining_minutes <= 0                          as is_zero_purchased,
  fn_is_generic_low_credit(b.remaining_minutes)
    or fn_is_dynamic_low(
      b.remaining_minutes::numeric / 60.0,
      u.avg_month_minutes / 60.0
    )                                               as is_low_any
from base b
left join usage_by_delivery u
  on u.student_id = b.student_id
 and u.delivery   = b.delivery;


-------------------------------
-- v_student_usage_last_3m
-------------------------------
create or replace view public.v_student_usage_last_3m as
with monthly as (
    select
      l.student_id,
      date_trunc('month', l.occurred_at) as month_start,
      sum(l.duration_min)                as minutes_taken
    from lessons l
    where l.state = 'confirmed'::lesson_state
      and l.occurred_at >= date_trunc('month', now() - interval '3 mons')
    group by
      l.student_id,
      date_trunc('month', l.occurred_at)
),
agg as (
    select
      m.student_id,
      count(*)             as months_count,
      sum(m.minutes_taken) as minutes_last_3m,
      avg(m.minutes_taken) as avg_month_minutes
    from monthly m
    group by m.student_id
)
select
  student_id,
  months_count,
  minutes_last_3m,
  avg_month_minutes,
  avg_month_minutes / 60.0         as avg_month_hours,
  (avg_month_minutes / 60.0) / 4.3 as avg_week_hours,
  fn_is_heavy_user(avg_month_minutes) as is_heavy_user
from agg;


-------------------------------
-- v_student_snc_lessons
-------------------------------
create or replace view public.v_student_snc_lessons as
select
  l.id          as lesson_id,
  l.student_id,
  l.teacher_id,
  l.occurred_at,
  l.duration_min,
  l.delivery,
  l.is_snc,
  l.snc_mode,
  (l.snc_mode = 'charged'::snc_mode) as is_charged
from lessons l
where fn_is_snc_lesson(l.is_snc, l.state);


-------------------------------
-- v_student_snc_status_by_month
-------------------------------
create or replace view public.v_student_snc_status_by_month as
select
  l.student_id,
  date_trunc('month', timezone('Europe/London', l.occurred_at))::date as month_start,
  count(*) filter (where l.snc_mode = 'free'::snc_mode)    as free_sncs,
  count(*) filter (where l.snc_mode = 'charged'::snc_mode) as charged_sncs,
  count(*) filter (where l.snc_mode = 'free'::snc_mode) > 0 as has_free_snc_used
from lessons l
where fn_is_snc_lesson(l.is_snc, l.state)
group by
  l.student_id,
  date_trunc('month', timezone('Europe/London', l.occurred_at))::date;


-------------------------------
-- v_snc_overuse_hazards_raw
-------------------------------
create or replace view public.v_snc_overuse_hazards_raw as
with monthly_snc as (
    select
      l.student_id,
      date_trunc('month', l.occurred_at)::date as month_start,
      count(*)                                 as snc_count
    from lessons l
    where fn_is_snc_lesson(l.is_snc, l.state)
    group by
      l.student_id,
      date_trunc('month', l.occurred_at)
),
overuse as (
    select
      m.student_id,
      m.month_start,
      m.snc_count
    from monthly_snc m
    where fn_is_snc_overuse(m.snc_count)
)
select
  l.id          as lesson_id,
  l.student_id,
  l.teacher_id,
  l.occurred_at,
  o.month_start,
  o.snc_count,
  'snc_overuse'::hazard_type as hazard_type
from lessons l
join overuse o
  on o.student_id = l.student_id
 and date_trunc('month', l.occurred_at)::date = o.month_start
where fn_is_snc_lesson(l.is_snc, l.state);


-------------------------------
-- v_snc_stats_by_month
-- (only uses "confirmed lesson" rule; left as-is except for style)
-------------------------------
create or replace view public.v_snc_stats_by_month as
with base as (
    select
      date_trunc('month', l.occurred_at)::date as month_start,
      l.teacher_id,
      l.student_id,
      s.tier                                   as student_tier,
      l.duration_min,
      l.is_snc,
      l.snc_mode,
      l.state,
      coalesce(m.revenue_pennies, 0)          as revenue_pennies,
      coalesce(m.teacher_earnings_pennies, 0) as teacher_earnings_pennies,
      coalesce(m.margin_after_drinks_pennies, 0) as margin_after_drinks_pennies
    from lessons l
    join students s
      on s.id = l.student_id
    left join v_lesson_margin_with_drinks_with_names m
      on m.lesson_id = l.id
    where l.state = 'confirmed'::lesson_state
)
select
  month_start,
  teacher_id,
  student_id,
  student_tier,
  count(*)                        as lesson_count_total,
  sum(duration_min)               as lesson_minutes_total,
  count(*) filter (where is_snc)  as snc_lesson_count,
  sum(duration_min) filter (where is_snc) as snc_minutes_total,
  count(*) filter (
    where is_snc and snc_mode = 'free'::snc_mode
  ) as free_snc_lesson_count,
  sum(duration_min) filter (
    where is_snc and snc_mode = 'free'::snc_mode
  ) as free_snc_minutes_total,
  count(*) filter (
    where is_snc and snc_mode = 'charged'::snc_mode
  ) as charged_snc_lesson_count,
  sum(duration_min) filter (
    where is_snc and snc_mode = 'charged'::snc_mode
  ) as charged_snc_minutes_total,
  case
    when count(*) = 0 then 0::numeric
    else count(*) filter (where is_snc)::numeric * 100.0 / count(*)::numeric
  end as snc_rate_pct,
  sum(revenue_pennies)                     as total_revenue_pennies,
  sum(teacher_earnings_pennies)            as total_teacher_pay_pennies,
  sum(margin_after_drinks_pennies)         as total_margin_after_drinks_pennies,
  sum(revenue_pennies) filter (where is_snc) as snc_revenue_pennies,
  sum(teacher_earnings_pennies) filter (where is_snc) as snc_teacher_pay_pennies,
  sum(margin_after_drinks_pennies) filter (where is_snc) as snc_margin_after_drinks_pennies,
  sum(revenue_pennies) filter (
    where is_snc and snc_mode = 'free'::snc_mode
  ) as free_snc_revenue_pennies,
  sum(teacher_earnings_pennies) filter (
    where is_snc and snc_mode = 'free'::snc_mode
  ) as free_snc_teacher_pay_pennies,
  sum(margin_after_drinks_pennies) filter (
    where is_snc and snc_mode = 'free'::snc_mode
  ) as free_snc_margin_after_drinks_pennies,
  sum(revenue_pennies) filter (
    where is_snc and snc_mode = 'charged'::snc_mode
  ) as charged_snc_revenue_pennies,
  sum(teacher_earnings_pennies) filter (
    where is_snc and snc_mode = 'charged'::snc_mode
  ) as charged_snc_teacher_pay_pennies,
  sum(margin_after_drinks_pennies) filter (
    where is_snc and snc_mode = 'charged'::snc_mode
  ) as charged_snc_margin_after_drinks_pennies
from base
group by
  month_start,
  teacher_id,
  student_id,
  student_tier;
