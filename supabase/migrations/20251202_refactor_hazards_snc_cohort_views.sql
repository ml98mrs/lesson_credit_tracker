-- 20251201_refactor_hazards_snc_cohort_views.sql
-- Refactor hazard, SNC, and cohort-related views for readability and consistency.

------------------------------------------------------------
-- Allocation delivery hazards (raw + unresolved)
------------------------------------------------------------
create or replace view public.v_allocation_delivery_hazards_raw as
select
  a.id           as allocation_id,
  a.lesson_id,
  a.credit_lot_id,
  l.delivery     as lesson_delivery,
  cl.delivery_restriction as lot_delivery_restriction,
  fn_delivery_hazard_type(l.delivery, cl.delivery_restriction)::hazard_type as hazard_type
from allocations a
join lessons l
  on l.id = a.lesson_id
join credit_lots cl
  on cl.id = a.credit_lot_id
where fn_is_delivery_mismatch(l.delivery, cl.delivery_restriction);

create or replace view public.v_allocation_delivery_hazards as
select
  r.allocation_id,
  r.lesson_id,
  r.credit_lot_id,
  r.lesson_delivery,
  r.lot_delivery_restriction,
  r.hazard_type
from v_allocation_delivery_hazards_raw r
left join hazard_resolutions h
  on h.allocation_id = r.allocation_id
 and h.hazard_type   = r.hazard_type
where h.id is null;


------------------------------------------------------------
-- Allocation length restriction hazards (raw + unresolved)
------------------------------------------------------------
create or replace view public.v_allocation_length_restriction_hazards_raw as
with base as (
  select
    a.id            as allocation_id,
    a.lesson_id,
    a.credit_lot_id,
    l.duration_min,
    cl.length_restriction,
    fn_length_threshold(cl.length_restriction) as threshold_min
  from allocations a
  join lessons l
    on l.id = a.lesson_id
  join credit_lots cl
    on cl.id = a.credit_lot_id
)
select
  allocation_id,
  lesson_id,
  credit_lot_id,
  duration_min,
  length_restriction,
  threshold_min,
  'length_restriction_mismatch'::hazard_type as hazard_type
from base
where threshold_min is not null
  and duration_min < threshold_min;

create or replace view public.v_allocation_length_restriction_hazards as
select
  r.allocation_id,
  r.lesson_id,
  r.credit_lot_id,
  r.hazard_type
from v_allocation_length_restriction_hazards_raw r
left join hazard_resolutions h
  on h.allocation_id = r.allocation_id
 and h.hazard_type   = r.hazard_type
where h.id is null;


------------------------------------------------------------
-- Lesson length hazards (raw + unresolved)
------------------------------------------------------------
create or replace view public.v_lesson_length_hazards_raw as
select
  l.id          as lesson_id,
  l.student_id,
  l.teacher_id,
  l.duration_min,
  l.length_cat,
  fn_length_threshold(l.length_cat) as threshold_min,
  'length_too_short'::hazard_type   as hazard_type
from lessons l
where l.state = 'confirmed'::lesson_state
  and fn_is_length_too_short(l.length_cat, l.duration_min);

create or replace view public.v_lesson_length_hazards as
select
  r.lesson_id,
  r.student_id,
  r.teacher_id,
  r.duration_min,
  r.length_cat,
  r.threshold_min,
  r.hazard_type
from v_lesson_length_hazards_raw r
left join hazard_resolutions h
  on h.lesson_id   = r.lesson_id
 and h.hazard_type = r.hazard_type
where h.id is null;


------------------------------------------------------------
-- Overdraft allocation hazards (unresolved)
------------------------------------------------------------
create or replace view public.v_overdraft_allocation_hazards as
select
  a.lesson_id,
  a.id as allocation_id,
  'overdraft_allocation'::hazard_type as hazard_type
from allocations a
join credit_lots cl
  on cl.id = a.credit_lot_id
left join hazard_resolutions h
  on h.allocation_id = a.id
 and h.hazard_type   = 'overdraft_allocation'::hazard_type
where cl.source_type = 'overdraft'::text
  and h.id is null;


------------------------------------------------------------
-- SNC overuse hazards (raw + unresolved)
------------------------------------------------------------
create or replace view public.v_snc_overuse_hazards_raw as
with monthly_snc as (
  select
    l.student_id,
    date_trunc('month', l.occurred_at)::date as month_start,
    count(*)                                 as snc_count
  from lessons l
  where l.is_snc = true
    and l.state  = 'confirmed'::lesson_state
  group by l.student_id, date_trunc('month', l.occurred_at)
),
overuse as (
  select
    m.student_id,
    m.month_start,
    m.snc_count
  from monthly_snc m
  where m.snc_count > 3
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
where l.is_snc = true
  and l.state  = 'confirmed'::lesson_state;

create or replace view public.v_snc_overuse_hazards as
select
  r.lesson_id,
  r.student_id,
  r.teacher_id,
  r.month_start,
  r.snc_count,
  r.hazard_type
from v_snc_overuse_hazards_raw r
left join hazard_resolutions h
  on h.lesson_id   = r.lesson_id
 and h.hazard_type = r.hazard_type
where h.id is null;


------------------------------------------------------------
-- Lesson hazards (combined, unresolved)
------------------------------------------------------------
create or replace view public.v_lesson_hazards as
-- 1) Lesson-level length hazards
select
  r.lesson_id,
  null::uuid as allocation_id,
  r.hazard_type,
  case
    when r.hazard_type = 'length_too_short'::hazard_type then 'amber'::text
    else 'unknown'::text
  end as severity
from v_lesson_length_hazards r

union all

-- 2) Allocation-level delivery hazards
select
  r.lesson_id,
  r.allocation_id,
  r.hazard_type,
  case
    when r.hazard_type = 'delivery_f2f_on_online'::hazard_type then 'red'::text
    when r.hazard_type = 'delivery_online_on_f2f'::hazard_type then 'yellow'::text
    else 'unknown'::text
  end as severity
from v_allocation_delivery_hazards r

union all

-- 3) Allocation-level length restriction hazards
select
  r.lesson_id,
  r.allocation_id,
  r.hazard_type,
  'amber'::text as severity
from v_allocation_length_restriction_hazards r

union all

-- 4) Lesson-level SNC overuse hazards
select
  r.lesson_id,
  null::uuid as allocation_id,
  r.hazard_type,
  'yellow'::text as severity
from v_snc_overuse_hazards r

union all

-- 5) Overdraft allocation hazards
select
  r.lesson_id,
  r.allocation_id,
  r.hazard_type,
  'amber'::text as severity
from v_overdraft_allocation_hazards r;


------------------------------------------------------------
-- Credit expiry by month
------------------------------------------------------------
create or replace view public.v_credit_expiry_by_month as
with lot_usage as (
  select
    cl.id                 as credit_lot_id,
    cl.student_id,
    cl.source_type,
    cl.expiry_date,
    cl.expiry_policy,
    cl.length_restriction,
    cl.delivery_restriction,
    cl.tier_restriction,
    cl.minutes_granted,
    coalesce(sum(a.minutes_allocated), 0::bigint) as minutes_used
  from credit_lots cl
  left join allocations a
    on a.credit_lot_id = cl.id
  group by
    cl.id,
    cl.student_id,
    cl.source_type,
    cl.expiry_date,
    cl.expiry_policy,
    cl.length_restriction,
    cl.delivery_restriction,
    cl.tier_restriction,
    cl.minutes_granted
),
with_names as (
  select
    lu.credit_lot_id,
    lu.student_id,
    lu.source_type,
    lu.expiry_date,
    lu.expiry_policy,
    lu.length_restriction,
    lu.delivery_restriction,
    lu.tier_restriction,
    lu.minutes_granted,
    lu.minutes_used,
    vn.full_name as student_name
  from lot_usage lu
  left join v_student_names vn
    on vn.student_id = lu.student_id
)
select
  date_trunc('month', expiry_date::timestamptz)::date as month_start,
  student_id,
  student_name,
  source_type,
  expiry_policy,
  length_restriction,
  delivery_restriction,
  tier_restriction,
  sum(minutes_granted)                                       as minutes_granted_total,
  sum(minutes_used)                                          as minutes_used_total,
  sum(greatest(minutes_granted - minutes_used, 0::bigint))   as minutes_expired_unused
from with_names
where expiry_date is not null
  and expiry_date < current_date
group by
  date_trunc('month', expiry_date::timestamptz)::date,
  student_id,
  student_name,
  source_type,
  expiry_policy,
  length_restriction,
  delivery_restriction,
  tier_restriction;


------------------------------------------------------------
-- SNC stats by month (base + with names)
------------------------------------------------------------
create or replace view public.v_snc_stats_by_month as
with base as (
  select
    date_trunc('month', l.occurred_at)::date as month_start,
    l.teacher_id,
    l.student_id,
    s.tier                                    as student_tier,
    l.duration_min,
    l.is_snc,
    l.snc_mode,
    l.state,
    coalesce(m.revenue_pennies,            0) as revenue_pennies,
    coalesce(m.teacher_earnings_pennies,   0) as teacher_earnings_pennies,
    coalesce(m.margin_after_drinks_pennies,0) as margin_after_drinks_pennies
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
  count(*)                           as lesson_count_total,
  sum(duration_min)                  as lesson_minutes_total,
  count(*) filter (where is_snc)     as snc_lesson_count,
  sum(duration_min) filter (where is_snc)                                   as snc_minutes_total,
  count(*) filter (where is_snc and snc_mode = 'free'::snc_mode)            as free_snc_lesson_count,
  sum(duration_min) filter (where is_snc and snc_mode = 'free'::snc_mode)   as free_snc_minutes_total,
  count(*) filter (where is_snc and snc_mode = 'charged'::snc_mode)         as charged_snc_lesson_count,
  sum(duration_min) filter (where is_snc and snc_mode = 'charged'::snc_mode) as charged_snc_minutes_total,
  case
    when count(*) = 0 then 0::numeric
    else count(*) filter (where is_snc)::numeric * 100.0 / count(*)::numeric
  end                                        as snc_rate_pct,
  sum(revenue_pennies)                       as total_revenue_pennies,
  sum(teacher_earnings_pennies)              as total_teacher_pay_pennies,
  sum(margin_after_drinks_pennies)           as total_margin_after_drinks_pennies,
  sum(revenue_pennies)             filter (where is_snc)                      as snc_revenue_pennies,
  sum(teacher_earnings_pennies)    filter (where is_snc)                      as snc_teacher_pay_pennies,
  sum(margin_after_drinks_pennies) filter (where is_snc)                      as snc_margin_after_drinks_pennies,
  sum(revenue_pennies)             filter (where is_snc and snc_mode = 'free'::snc_mode)    as free_snc_revenue_pennies,
  sum(teacher_earnings_pennies)    filter (where is_snc and snc_mode = 'free'::snc_mode)    as free_snc_teacher_pay_pennies,
  sum(margin_after_drinks_pennies) filter (where is_snc and snc_mode = 'free'::snc_mode)    as free_snc_margin_after_drinks_pennies,
  sum(revenue_pennies)             filter (where is_snc and snc_mode = 'charged'::snc_mode) as charged_snc_revenue_pennies,
  sum(teacher_earnings_pennies)    filter (where is_snc and snc_mode = 'charged'::snc_mode) as charged_snc_teacher_pay_pennies,
  sum(margin_after_drinks_pennies) filter (where is_snc and snc_mode = 'charged'::snc_mode) as charged_snc_margin_after_drinks_pennies
from base
group by
  month_start,
  teacher_id,
  student_id,
  student_tier;

create or replace view public.v_snc_stats_by_month_with_names as
select
  v.month_start,
  v.teacher_id,
  coalesce(pt.preferred_name, pt.full_name) as teacher_name,
  v.student_id,
  coalesce(ps.preferred_name, ps.full_name) as student_name,
  v.student_tier,
  v.lesson_count_total,
  v.lesson_minutes_total,
  v.snc_lesson_count,
  v.snc_minutes_total,
  v.free_snc_lesson_count,
  v.free_snc_minutes_total,
  v.charged_snc_lesson_count,
  v.charged_snc_minutes_total,
  v.snc_rate_pct,
  v.total_revenue_pennies,
  v.total_teacher_pay_pennies,
  v.total_margin_after_drinks_pennies,
  v.snc_revenue_pennies,
  v.snc_teacher_pay_pennies,
  v.snc_margin_after_drinks_pennies,
  v.free_snc_revenue_pennies,
  v.free_snc_teacher_pay_pennies,
  v.free_snc_margin_after_drinks_pennies,
  v.charged_snc_revenue_pennies,
  v.charged_snc_teacher_pay_pennies,
  v.charged_snc_margin_after_drinks_pennies
from v_snc_stats_by_month v
left join teachers t
  on t.id = v.teacher_id
left join profiles pt
  on pt.id = t.profile_id
left join students s
  on s.id = v.student_id
left join profiles ps
  on ps.id = s.profile_id;


------------------------------------------------------------
-- Student SNC helpers (lessons, by month, previous month)
------------------------------------------------------------
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
  l.snc_mode = 'charged'::snc_mode as is_charged
from lessons l
where l.is_snc = true
  and l.state  = 'confirmed'::lesson_state;

create or replace view public.v_student_snc_status_by_month as
select
  l.student_id,
  date_trunc('month', timezone('Europe/London', l.occurred_at))::date as month_start,
  count(*) filter (where l.snc_mode = 'free'::snc_mode)    as free_sncs,
  count(*) filter (where l.snc_mode = 'charged'::snc_mode) as charged_sncs,
  count(*) filter (where l.snc_mode = 'free'::snc_mode) > 0 as has_free_snc_used
from lessons l
where l.is_snc = true
  and l.state  = 'confirmed'::lesson_state
group by
  l.student_id,
  date_trunc('month', timezone('Europe/London', l.occurred_at))::date;

create or replace view public.v_student_snc_status_previous_month as
select
  student_id,
  free_sncs,
  charged_sncs,
  has_free_snc_used
from v_student_snc_status_by_month
where month_start = date_trunc(
                      'month',
                      timezone('Europe/London', now() - interval '1 mon')
                    )::date;


------------------------------------------------------------
-- Student cohort base + summary
------------------------------------------------------------
create or replace view public.v_student_cohort_base as
with first_lessons as (
  select
    l.student_id,
    min(l.occurred_at) as first_lesson_at
  from lessons l
  where l.state = 'confirmed'::lesson_state
  group by l.student_id
),
first_teacher as (
  select distinct on (l.student_id)
    l.student_id,
    l.teacher_id as first_teacher_id
  from lessons l
  join first_lessons fl
    on fl.student_id = l.student_id
  where l.state = 'confirmed'::lesson_state
  order by l.student_id, l.occurred_at, l.id
),
lesson_gaps as (
  select
    l.student_id,
    l.occurred_at,
    lag(l.occurred_at) over (
      partition by l.student_id
      order by l.occurred_at
    ) as prev_occurred_at
  from lessons l
  where l.state = 'confirmed'::lesson_state
),
cohort_agg as (
  select
    s.id as student_id,
    date_trunc('month', fl.first_lesson_at)::date as cohort_month,
    fl.first_lesson_at,
    ft.first_teacher_id,
    s.tier   as student_tier,
    s.status as current_status,
    sum(l.duration_min) filter (
      where l.occurred_at >= fl.first_lesson_at
        and l.occurred_at < (fl.first_lesson_at + interval '3 mons')
    ) as minutes_0_3m,
    sum(l.duration_min) filter (
      where l.occurred_at >= fl.first_lesson_at
        and l.occurred_at < (fl.first_lesson_at + interval '6 mons')
    ) as minutes_0_6m,
    sum(l.duration_min) filter (
      where l.occurred_at >= fl.first_lesson_at
        and l.occurred_at < (fl.first_lesson_at + interval '1 year')
    ) as minutes_0_12m,
    bool_or(
      l.occurred_at >= fl.first_lesson_at
      and l.occurred_at < (fl.first_lesson_at + interval '3 mons')
    ) as active_0_3m,
    bool_or(
      l.occurred_at >= fl.first_lesson_at
      and l.occurred_at < (fl.first_lesson_at + interval '6 mons')
    ) as active_0_6m,
    bool_or(
      l.occurred_at >= fl.first_lesson_at
      and l.occurred_at < (fl.first_lesson_at + interval '1 year')
    ) as active_0_12m,
    exists (
      select 1
      from lesson_gaps g
      where g.student_id        = s.id
        and g.prev_occurred_at is not null
        and (g.occurred_at - g.prev_occurred_at) >= interval '90 days'
    ) as has_long_gap_history,
    exists (
      select 1
      from lesson_gaps g
      where g.student_id        = s.id
        and g.prev_occurred_at is not null
        and (g.occurred_at - g.prev_occurred_at) >= interval '90 days'
    )
    and s.status = 'current'::student_status as reactivated
  from students s
  join first_lessons fl
    on fl.student_id = s.id
  left join first_teacher ft
    on ft.student_id = s.id
  left join lessons l
    on l.student_id = s.id
   and l.state      = 'confirmed'::lesson_state
  group by
    s.id,
    fl.first_lesson_at,
    ft.first_teacher_id,
    s.tier,
    s.status
)
select
  student_id,
  cohort_month,
  first_lesson_at,
  first_teacher_id,
  student_tier,
  current_status,
  minutes_0_3m,
  minutes_0_6m,
  minutes_0_12m,
  active_0_3m,
  active_0_6m,
  active_0_12m,
  has_long_gap_history,
  reactivated
from cohort_agg;

create or replace view public.v_student_cohort_summary as
select
  cb.cohort_month,
  cb.student_tier,
  cb.first_teacher_id,
  coalesce(pt.preferred_name, pt.full_name) as first_teacher_name,
  count(*)                                   as cohort_size,
  sum(case when cb.active_0_3m then 1 else 0 end) as active_0_3m_count,
  sum(case when cb.active_0_6m then 1 else 0 end) as active_0_6m_count,
  sum(case when cb.active_0_12m then 1 else 0 end) as active_0_12m_count,
  case
    when count(*) = 0 then 0::numeric
    else sum(case when cb.active_0_3m then 1 else 0 end)::numeric * 100.0 / count(*)::numeric
  end as active_0_3m_pct,
  case
    when count(*) = 0 then 0::numeric
    else sum(case when cb.active_0_6m then 1 else 0 end)::numeric * 100.0 / count(*)::numeric
  end as active_0_6m_pct,
  case
    when count(*) = 0 then 0::numeric
    else sum(case when cb.active_0_12m then 1 else 0 end)::numeric * 100.0 / count(*)::numeric
  end as active_0_12m_pct,
  sum(cb.minutes_0_3m) as minutes_0_3m_total,
  sum(cb.minutes_0_6m) as minutes_0_6m_total,
  sum(cb.minutes_0_12m) as minutes_0_12m_total,
  avg(cb.minutes_0_3m) as minutes_0_3m_avg,
  avg(cb.minutes_0_6m) as minutes_0_6m_avg,
  avg(cb.minutes_0_12m) as minutes_0_12m_avg,
  sum(case when cb.reactivated then 1 else 0 end) as reactivated_count
from v_student_cohort_base cb
left join teachers t
  on t.id = cb.first_teacher_id
left join profiles pt
  on pt.id = t.profile_id
group by
  cb.cohort_month,
  cb.student_tier,
  cb.first_teacher_id,
  coalesce(pt.preferred_name, pt.full_name);
