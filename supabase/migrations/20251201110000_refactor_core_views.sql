-- 20251201_refactor_core_views.sql
-- Core view refactors: credit lots, invoices, margins, and dynamic alerts.

------------------------------------------------------------
-- v_credit_lot_remaining
------------------------------------------------------------
create or replace view public.v_credit_lot_remaining as
with lot_allocations as (
  select
    a.credit_lot_id,
    coalesce(sum(a.minutes_allocated), 0::bigint) as minutes_allocated
  from allocations a
  group by a.credit_lot_id
),
lot_with_usage as (
  select
    cl.id                                   as credit_lot_id,
    cl.student_id,
    cl.source_type,
    cl.award_reason_code,
    cl.external_ref,
    cl.minutes_granted,
    coalesce(la.minutes_allocated, 0::bigint)::integer as minutes_allocated,
    (cl.minutes_granted - coalesce(la.minutes_allocated, 0::bigint))::integer as minutes_remaining,
    (cl.minutes_granted - coalesce(la.minutes_allocated, 0::bigint)) < 0       as is_overdrawn,
    cl.delivery_restriction,
    cl.tier_restriction,
    cl.length_restriction,
    cl.start_date,
    cl.expiry_policy,
    cl.expiry_date,
    cl.state,
    cl.created_at
  from credit_lots cl
  left join lot_allocations la
    on la.credit_lot_id = cl.id
)
select
  credit_lot_id,
  student_id,
  source_type,
  award_reason_code,
  external_ref,
  minutes_granted,
  minutes_allocated,
  minutes_remaining,
  is_overdrawn,
  delivery_restriction,
  tier_restriction,
  length_restriction,
  start_date,
  expiry_policy,
  expiry_date,
  case
    when expiry_date is null then null::integer
    else expiry_date - current_date
  end as days_to_expiry,
  expiry_date is not null
    and expiry_date >= current_date
    and expiry_date <= (current_date + 30) as expiry_within_30d,
  case
    when state = 'open'::credit_lot_state
      and minutes_remaining <= 0
      then 'closed'::credit_lot_state
    else state
  end as state,
  created_at
from lot_with_usage;


------------------------------------------------------------
-- v_teacher_invoice_summary
------------------------------------------------------------
create or replace view public.v_teacher_invoice_summary as
with month_keys as (
  -- any month where the teacher has earnings
  select
    e.teacher_id,
    e.month_start
  from v_teacher_lesson_earnings_by_month e

  union

  -- or expenses
  select
    x.teacher_id,
    x.month_start
  from v_teacher_expenses_summary x

  union

  -- or an invoice row
  select
    ti.teacher_id,
    ti.month_start
  from teacher_invoices ti
),
combined as (
  select
    mk.teacher_id,
    mk.month_start,
    coalesce(e.gross_pennies,    0::bigint) as lesson_gross_pennies,
    coalesce(x.approved_pennies, 0::bigint) as expenses_pennies,
    coalesce(e.gross_pennies,    0::bigint)
      + coalesce(x.approved_pennies, 0::bigint) as total_pennies,
    ti.id     as invoice_id,
    ti.status as invoice_status
  from month_keys mk
  left join v_teacher_lesson_earnings_by_month e
    on e.teacher_id = mk.teacher_id
   and e.month_start = mk.month_start
  left join v_teacher_expenses_summary x
    on x.teacher_id = mk.teacher_id
   and x.month_start = mk.month_start
  left join teacher_invoices ti
    on ti.teacher_id = mk.teacher_id
   and ti.month_start = mk.month_start
)
select
  teacher_id,
  month_start,
  lesson_gross_pennies,
  expenses_pennies,
  total_pennies,
  case
    when invoice_id is null                then 'not_generated'::text
    when invoice_status = 'paid'::text     then 'paid'::text
    else 'generated'::text
  end as status
from combined;


------------------------------------------------------------
-- v_teacher_margin_by_month
------------------------------------------------------------
create or replace view public.v_teacher_margin_by_month as
with revenue as (
  select
    teacher_id,
    month_start,
    revenue_pennies
  from v_teacher_lesson_revenue_by_month
),
earnings as (
  select
    teacher_id,
    month_start,
    lesson_minutes_total,
    gross_pennies,
    snc_free_minutes,
    snc_charged_minutes
  from v_teacher_lesson_earnings_by_month
),
expenses as (
  select
    teacher_id,
    date_trunc('month', timezone('Europe/London', incurred_at))::date as month_start,
    sum(
      case
        when status = 'approved'::text
         and category = 'drinks'::text
          then amount_pennies
        else 0
      end
    ) as expenses_approved_pennies,
    sum(
      case
        when status = 'pending'::text
         and category = 'drinks'::text
          then amount_pennies
        else 0
      end
    ) as expenses_pending_pennies,
    sum(
      case
        when status = 'rejected'::text
         and category = 'drinks'::text
          then amount_pennies
        else 0
      end
    ) as expenses_rejected_pennies
  from teacher_expenses
  group by
    teacher_id,
    date_trunc('month', timezone('Europe/London', incurred_at))::date
),
joined as (
  select
    coalesce(r.teacher_id, e.teacher_id, x.teacher_id)     as teacher_id,
    coalesce(r.month_start, e.month_start, x.month_start)  as month_start,
    coalesce(r.revenue_pennies, 0::bigint)                 as revenue_pennies,
    coalesce(e.lesson_minutes_total, 0::bigint)            as lesson_minutes_total,
    coalesce(e.snc_free_minutes, 0::bigint)                as snc_free_minutes,
    coalesce(e.snc_charged_minutes, 0::bigint)             as snc_charged_minutes,
    coalesce(e.gross_pennies, 0::bigint)                   as teacher_earnings_pennies,
    coalesce(x.expenses_approved_pennies, 0::bigint)       as expenses_approved_pennies,
    coalesce(x.expenses_pending_pennies, 0::bigint)        as expenses_pending_pennies,
    coalesce(x.expenses_rejected_pennies, 0::bigint)       as expenses_rejected_pennies
  from revenue  r
  full join earnings e using (teacher_id, month_start)
  full join expenses x using (teacher_id, month_start)
)
select
  teacher_id,
  month_start,
  revenue_pennies,
  lesson_minutes_total,
  snc_free_minutes,
  snc_charged_minutes,
  teacher_earnings_pennies,
  expenses_approved_pennies,
  expenses_pending_pennies,
  expenses_rejected_pennies,
  revenue_pennies - teacher_earnings_pennies                                as margin_before_expenses_pennies,
  revenue_pennies - teacher_earnings_pennies - expenses_approved_pennies    as margin_after_expenses_pennies,
  case
    when revenue_pennies > 0 then
      (revenue_pennies - teacher_earnings_pennies)::numeric * 100.0
      / revenue_pennies::numeric
    else null::numeric
  end as margin_before_expenses_pct,
  case
    when revenue_pennies > 0 then
      (revenue_pennies - teacher_earnings_pennies - expenses_approved_pennies)::numeric * 100.0
      / revenue_pennies::numeric
    else null::numeric
  end as margin_after_expenses_pct
from joined;


------------------------------------------------------------
-- v_lesson_margin_with_drinks_detail
------------------------------------------------------------
create or replace view public.v_lesson_margin_with_drinks_detail as
with lesson_totals as (
  select
    m.teacher_id,
    m.student_id,
    date_trunc(
      'month',
      timezone('Europe/London', m.start_at)
    )::date as month_start,
    sum(
      case
        when m.delivery = 'f2f'::delivery then m.duration_min
        else 0
      end
    ) as total_minutes
  from v_lesson_margin_detail m
  group by
    m.teacher_id,
    m.student_id,
    date_trunc('month', timezone('Europe/London', m.start_at))::date
),
margin_with_drinks_base as (
  select
    m.lesson_id,
    m.teacher_id,
    m.student_id,
    m.start_at,
    m.duration_min,
    m.delivery,
    m.state,
    m.is_snc,
    m.snc_mode,
    m.student_tier,
    m.hourly_rate_pennies,
    m.teacher_earnings_pennies,
    m.revenue_pennies,
    m.margin_pennies                     as margin_before_drinks_pennies,
    lt.total_minutes,
    de.drinks_approved_pennies
  from v_lesson_margin_detail m
  left join lesson_totals lt
    on lt.teacher_id = m.teacher_id
   and lt.student_id = m.student_id
   and lt.month_start = date_trunc(
         'month',
         timezone('Europe/London', m.start_at)
       )::date
  left join v_teacher_drinks_expenses_by_student_month de
    on de.teacher_id = m.teacher_id
   and de.student_id = m.student_id
   and de.month_start = lt.month_start
),
with_drinks as (
  select
    b.*,
    case
      when b.delivery = 'f2f'::delivery
       and b.total_minutes is not null
       and b.total_minutes > 0
       and b.drinks_approved_pennies is not null
        then round(
          b.duration_min::numeric
          * b.drinks_approved_pennies::numeric
          / b.total_minutes::numeric
        )::integer
      else 0
    end as drinks_allocated_pennies
  from margin_with_drinks_base b
)
select
  lesson_id,
  teacher_id,
  student_id,
  start_at,
  duration_min,
  delivery,
  state,
  is_snc,
  snc_mode,
  student_tier,
  hourly_rate_pennies,
  teacher_earnings_pennies,
  revenue_pennies,
  margin_before_drinks_pennies,
  drinks_allocated_pennies,
  margin_before_drinks_pennies - drinks_allocated_pennies       as margin_after_drinks_pennies,
  case
    when revenue_pennies > 0 then
      (margin_before_drinks_pennies - drinks_allocated_pennies)::numeric * 100.0
      / revenue_pennies::numeric
    else null::numeric
  end as margin_after_drinks_pct,
  date_trunc('month', timezone('Europe/London', start_at))::date as month_start,
  case
    when duration_min = 60  then '60'::length_cat
    when duration_min = 90  then '90'::length_cat
    when duration_min = 120 then '120'::length_cat
    else 'none'::length_cat
  end as length_cat
from with_drinks;


------------------------------------------------------------
-- v_student_dynamic_credit_alerts_by_delivery
------------------------------------------------------------
create or replace view public.v_student_dynamic_credit_alerts_by_delivery as
with purchased_by_delivery as (
  select
    s.student_id,
    'online'::delivery as delivery,
    s.purchased_online_min as purchased_minutes
  from v_student_credit_delivery_summary s
  where s.purchased_online_min > 0

  union all

  select
    s.student_id,
    'f2f'::delivery as delivery,
    s.purchased_f2f_min as purchased_minutes
  from v_student_credit_delivery_summary s
  where s.purchased_f2f_min > 0
),
remaining_by_delivery as (
  select
    v.student_id,
    v.delivery_restriction as delivery,
    sum(v.minutes_remaining)::integer as remaining_minutes
  from v_credit_lot_remaining v
  join students s
    on s.id = v.student_id
   and s.status <> 'past'::student_status
  where v.source_type = 'invoice'::text
    and v.state = 'open'::credit_lot_state
    and (v.expiry_date is null or v.expiry_date >= current_date)
    and v.delivery_restriction = any (array['online'::delivery, 'f2f'::delivery])
  group by v.student_id, v.delivery_restriction
),
monthly_by_delivery as (
  select
    l.student_id,
    l.delivery,
    date_trunc('month', l.occurred_at) as month_start,
    sum(l.duration_min) as minutes_taken
  from lessons l
  where l.state = 'confirmed'::lesson_state
    and l.delivery = any (array['online'::delivery, 'f2f'::delivery])
    and l.occurred_at >= date_trunc('month', now() - interval '3 mons')
  group by l.student_id, l.delivery, date_trunc('month', l.occurred_at)
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
   and r.delivery = p.delivery
)
select
  b.student_id,
  b.delivery,
  b.remaining_minutes,
  (b.remaining_minutes::numeric / 60.0)               as remaining_hours,
  (u.avg_month_minutes / 60.0)                        as avg_month_hours,
  (b.remaining_minutes::numeric / 60.0)
    - coalesce(u.avg_month_minutes / 60.0, 0.0)       as buffer_hours,
  b.remaining_minutes <= 360                          as is_generic_low,
  u.avg_month_minutes is not null
    and u.avg_month_minutes > 0.0
    and ((b.remaining_minutes::numeric / 60.0)
         - (u.avg_month_minutes / 60.0)) < 4.0        as is_dynamic_low,
  b.remaining_minutes <= 0                            as is_zero_purchased,
  b.remaining_minutes <= 360
    or (
      u.avg_month_minutes is not null
      and u.avg_month_minutes > 0.0
      and ((b.remaining_minutes::numeric / 60.0)
           - (u.avg_month_minutes / 60.0)) < 4.0
    )                                                 as is_low_any
from base b
left join usage_by_delivery u
  on u.student_id = b.student_id
 and u.delivery   = b.delivery;
