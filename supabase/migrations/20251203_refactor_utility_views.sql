-- 20251201_refactor_utility_views.sql
-- Refactor remaining utility / analytics views:
-- lesson margin, revenue, student/teacher usage, rates, names, lifecycle, etc.

------------------------------------------------------------
-- Lesson margin detail (teacher earnings + revenue)
------------------------------------------------------------
create or replace view public.v_lesson_margin_detail as
select
  e.lesson_id,
  e.teacher_id,
  e.student_id,
  e.start_at,
  e.duration_min,
  e.delivery,
  e.state,
  e.is_snc,
  e.snc_mode,
  e.student_tier,
  e.hourly_rate_pennies,
  e.gross_pennies                         as teacher_earnings_pennies,
  coalesce(r.revenue_pennies, 0)          as revenue_pennies,
  coalesce(r.revenue_pennies, 0) - e.gross_pennies as margin_pennies,
  case
    when r.revenue_pennies is not null and r.revenue_pennies > 0 then
      (coalesce(r.revenue_pennies, 0) - e.gross_pennies)::numeric * 100.0
      / r.revenue_pennies::numeric
    else null::numeric
  end as margin_pct
from v_teacher_lesson_earnings_detail e
left join v_lesson_revenue_detail r
  on r.lesson_id = e.lesson_id;


------------------------------------------------------------
-- Lesson margin with drinks + names
------------------------------------------------------------
create or replace view public.v_lesson_margin_with_drinks_with_names as
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
  m.margin_before_drinks_pennies,
  m.drinks_allocated_pennies,
  m.margin_after_drinks_pennies,
  m.margin_after_drinks_pct,
  m.month_start,
  m.length_cat,
  tn.display_name as teacher_name,
  tn.full_name    as teacher_full_name,
  sn.display_name as student_name,
  sn.full_name    as student_full_name
from v_lesson_margin_with_drinks_detail m
left join v_teacher_names tn
  on tn.teacher_id = m.teacher_id
left join v_student_names sn
  on sn.student_id = m.student_id;


------------------------------------------------------------
-- Lesson revenue detail (per lesson, from invoice lots)
------------------------------------------------------------
create or replace view public.v_lesson_revenue_detail as
select
  a.lesson_id,
  sum(
    round(
      a.minutes_allocated::numeric
      * cl.amount_pennies::numeric
      / cl.minutes_granted::numeric
    )
  )::integer as revenue_pennies
from allocations a
join credit_lots cl
  on cl.id = a.credit_lot_id
where cl.source_type    = 'invoice'::text
  and cl.amount_pennies is not null
  and cl.minutes_granted > 0
group by a.lesson_id;


------------------------------------------------------------
-- Lot allocations detail (who/what/when for each allocation)
------------------------------------------------------------
create or replace view public.v_lot_allocations_detail as
select
  a.id,
  a.credit_lot_id,
  a.lesson_id,
  a.minutes_allocated,
  a.created_at,
  l.occurred_at  as lesson_occurred_at,
  l.duration_min as lesson_duration_min,
  l.delivery     as lesson_delivery,
  l.is_snc       as lesson_is_snc,
  l.snc_mode     as lesson_snc_mode,
  s.id           as student_id,
  sp.full_name   as student_full_name,
  t.id           as teacher_id,
  tp.full_name   as teacher_full_name
from allocations a
join lessons l
  on l.id = a.lesson_id
join students s
  on s.id = l.student_id
join profiles sp
  on sp.id = s.profile_id
join teachers t
  on t.id = l.teacher_id
join profiles tp
  on tp.id = t.profile_id;


------------------------------------------------------------
-- Past students cleanup candidates
------------------------------------------------------------
create or replace view public.v_past_students_cleanup_candidates as
select
  s.id                                 as student_id,
  a.last_activity_at,
  coalesce(sum(v.minutes_remaining), 0::bigint) as remaining_minutes
from students s
join v_student_last_activity a
  on a.student_id = s.id
left join v_credit_lot_remaining v
  on v.student_id = s.id
where s.status = 'past'::student_status
group by s.id, a.last_activity_at;


------------------------------------------------------------
-- Student award reason summary
------------------------------------------------------------
create or replace view public.v_student_award_reason_summary as
select
  student_id,
  award_reason_code,
  coalesce(
    sum(minutes_granted)   filter (where source_type = 'award'::text),
    0::bigint
  )::integer as granted_award_min,
  coalesce(
    sum(minutes_allocated) filter (where source_type = 'award'::text),
    0::bigint
  )::integer as used_award_min,
  coalesce(
    sum(minutes_remaining) filter (where source_type = 'award'::text),
    0::bigint
  )::integer as remaining_award_min
from v_credit_lot_remaining
group by student_id, award_reason_code;


------------------------------------------------------------
-- Student credit delivery summary (invoice vs award / online vs f2f)
------------------------------------------------------------
create or replace view public.v_student_credit_delivery_summary as
with base as (
  select
    v.student_id,
    v.source_type,
    v.delivery_restriction,
    v.minutes_granted,
    v.minutes_allocated,
    v.minutes_remaining
  from v_credit_lot_remaining v
)
select
  student_id,
  coalesce(
    sum(minutes_granted)
      filter (
        where source_type = 'invoice'::text
          and minutes_granted > 0
      ),
    0::bigint
  )::integer as purchased_min,
  coalesce(
    sum(minutes_granted)
      filter (
        where source_type = 'award'::text
          and minutes_granted > 0
      ),
    0::bigint
  )::integer as awarded_min,
  coalesce(sum(minutes_allocated), 0::bigint)::integer as used_min,
  coalesce(sum(minutes_remaining), 0::bigint)::integer as remaining_min,
  coalesce(
    sum(minutes_granted)
      filter (
        where source_type = 'invoice'::text
          and minutes_granted > 0
          and delivery_restriction = 'online'::delivery
      ),
    0::bigint
  )::integer as purchased_online_min,
  coalesce(
    sum(minutes_granted)
      filter (
        where source_type = 'invoice'::text
          and minutes_granted > 0
          and delivery_restriction = 'f2f'::delivery
      ),
    0::bigint
  )::integer as purchased_f2f_min,
  coalesce(
    sum(minutes_allocated)
      filter (where delivery_restriction = 'online'::delivery),
    0::bigint
  )::integer as used_online_min,
  coalesce(
    sum(minutes_allocated)
      filter (where delivery_restriction = 'f2f'::delivery),
    0::bigint
  )::integer as used_f2f_min,
  coalesce(
    sum(minutes_remaining)
      filter (where delivery_restriction = 'online'::delivery),
    0::bigint
  )::integer as remaining_online_min,
  coalesce(
    sum(minutes_remaining)
      filter (where delivery_restriction = 'f2f'::delivery),
    0::bigint
  )::integer as remaining_f2f_min
from base
group by student_id;


------------------------------------------------------------
-- Student credit summary (totals + first upcoming expiry)
------------------------------------------------------------
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
  st.id as student_id,
  coalesce(s.total_granted_min,   0) as total_granted_min,
  coalesce(s.total_allocated_min, 0) as total_allocated_min,
  coalesce(s.total_remaining_min, 0) as total_remaining_min,
  coalesce(s.total_remaining_min, 0) <= 360 as low_credit,
  s.next_expiry_date,
  case
    when s.next_expiry_date is null then null::integer
    else s.next_expiry_date - current_date
  end as days_to_next_expiry,
  case
    when s.next_expiry_date is null then false
    else s.next_expiry_date <= (current_date + 30)
  end as expiry_within_30d
from students st
left join s
  on s.student_id = st.id;


------------------------------------------------------------
-- Student dynamic credit alerts (overall, not split by delivery)
------------------------------------------------------------
create or replace view public.v_student_dynamic_credit_alerts as
select
  cs.student_id,
  cs.total_remaining_min                         as remaining_minutes,
  cs.total_remaining_min::numeric / 60.0         as remaining_hours,
  u.avg_month_hours,
  cs.total_remaining_min::numeric / 60.0
    - coalesce(u.avg_month_hours, 0::numeric)    as buffer_hours,
  cs.total_remaining_min <= 360                  as is_generic_low,
  u.avg_month_hours is not null
    and u.avg_month_hours > 0::numeric
    and (
      cs.total_remaining_min::numeric / 60.0
      - u.avg_month_hours
    ) < 4.0                                      as is_dynamic_low,
  cs.total_remaining_min <= 360
    or (
      u.avg_month_hours is not null
      and u.avg_month_hours > 0::numeric
      and (
        cs.total_remaining_min::numeric / 60.0
        - u.avg_month_hours
      ) < 4.0
    )                                           as is_low_any
from v_student_credit_summary cs
join students s
  on s.id = cs.student_id
 and s.status <> 'past'::student_status
left join v_student_usage_last_3m u
  on u.student_id = cs.student_id;


------------------------------------------------------------
-- Student last activity
------------------------------------------------------------
create or replace view public.v_student_last_activity as
select
  s.id as student_id,
  coalesce(
    (
      select max(l.occurred_at)
      from lessons l
      where l.student_id = s.id
        and l.state      = 'confirmed'::lesson_state
    ),
    s.created_at
  ) as last_activity_at
from students s;


------------------------------------------------------------
-- Student lessons (student-facing summary)
------------------------------------------------------------
create or replace view public.v_student_lessons as
with lesson_allocs as (
  select
    a.lesson_id,
    string_agg(
      (
        case cl.source_type
          when 'overdraft'::text then 'Overdraft'
          when 'invoice'::text   then coalesce(cl.external_ref, 'Invoice credit')
          when 'award'::text     then coalesce('Award: ' || cl.award_reason_code, 'Award credit')
          when 'adjustment'::text then 'Adjustment'
          else cl.source_type
        end
        || ' (' || a.minutes_allocated::text || ' min)'
      ),
      ', '
      order by cl.source_type, cl.start_date nulls first, cl.id
    ) as allocation_summary
  from allocations a
  join credit_lots cl
    on cl.id = a.credit_lot_id
  group by a.lesson_id
)
select
  l.id          as lesson_id,
  l.student_id,
  l.teacher_id,
  p.full_name   as teacher_full_name,
  l.occurred_at,
  l.duration_min,
  l.delivery,
  l.length_cat,
  l.is_snc,
  l.snc_mode,
  l.state,
  l.created_at,
  la.allocation_summary
from lessons l
left join teachers t
  on t.id = l.teacher_id
left join profiles p
  on p.id = t.profile_id
left join lesson_allocs la
  on la.lesson_id = l.id;


------------------------------------------------------------
-- Student lifecycle summary
------------------------------------------------------------
create or replace view public.v_student_lifecycle_summary as
select
  count(*) filter (where status = 'current'::student_status)::integer as current,
  count(*) filter (where status = 'dormant'::student_status)::integer as dormant,
  count(*) filter (where status = 'past'::student_status)::integer    as past
from students;


------------------------------------------------------------
-- Student names (full + display)
------------------------------------------------------------
create or replace view public.v_student_names as
select
  s.id       as student_id,
  p.full_name,
  coalesce(p.preferred_name, p.full_name) as display_name
from students s
join profiles p
  on p.id = s.profile_id;


------------------------------------------------------------
-- Student teacher rate summary (effective rates per pair)
------------------------------------------------------------
create or replace view public.v_student_teacher_rate_summary as
with base as (
  select
    st.student_id,
    st.teacher_id,
    s.tier                         as student_tier,
    tr.default_online_rate_pennies,
    tr.f2f_basic_rate_pennies,
    tr.f2f_premium_rate_pennies,
    o.f2f_rate_pennies             as override_f2f_rate_pennies
  from student_teacher st
  join students s
    on s.id = st.student_id
  left join teacher_rates tr
    on tr.teacher_id = st.teacher_id
  left join teacher_student_f2f_overrides o
    on o.teacher_id = st.teacher_id
   and o.student_id = st.student_id
)
select
  student_id,
  teacher_id,
  student_tier,
  default_online_rate_pennies                     as effective_online_rate_pennies,
  case
    when override_f2f_rate_pennies is not null then override_f2f_rate_pennies
    when student_tier = any (array['premium'::tier, 'elite'::tier]) then f2f_premium_rate_pennies
    else f2f_basic_rate_pennies
  end                                            as effective_f2f_rate_pennies,
  override_f2f_rate_pennies is not null          as has_override,
  case
    when override_f2f_rate_pennies is not null then 'override'::text
    when default_online_rate_pennies is null
      and f2f_basic_rate_pennies   is null
      and f2f_premium_rate_pennies is null then 'no_rate'::text
    when student_tier = any (array['premium'::tier, 'elite'::tier]) then 'tier_premium'::text
    else 'tier_basic'::text
  end                                            as f2f_source
from base;


------------------------------------------------------------
-- Student usage last 3 months
------------------------------------------------------------
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
  avg_month_minutes / 60.0                as avg_month_hours,
  (avg_month_minutes / 60.0) / 4.3        as avg_week_hours,
  avg_month_minutes >= (12 * 60)::numeric as is_heavy_user
from agg;


------------------------------------------------------------
-- Teacher drinks expenses by student/month
------------------------------------------------------------
create or replace view public.v_teacher_drinks_expenses_by_student_month as
select
  teacher_id,
  student_id,
  date_trunc('month', timezone('Europe/London', incurred_at))::date as month_start,
  sum(
    case
      when status = 'approved'::text and category = 'drinks'::text
        then amount_pennies
      else 0
    end
  ) as drinks_approved_pennies,
  sum(
    case
      when status = 'pending'::text and category = 'drinks'::text
        then amount_pennies
      else 0
    end
  ) as drinks_pending_pennies,
  sum(
    case
      when status = 'rejected'::text and category = 'drinks'::text
        then amount_pennies
      else 0
    end
  ) as drinks_rejected_pennies
from teacher_expenses
group by
  teacher_id,
  student_id,
  date_trunc('month', timezone('Europe/London', incurred_at))::date;


------------------------------------------------------------
-- Teacher expenses detail by month (with student names)
------------------------------------------------------------
create or replace view public.v_teacher_expenses_detail_by_month as
select
  e.id,
  e.teacher_id,
  date_trunc('month', timezone('Europe/London', e.incurred_at))::date as month_start,
  e.incurred_at,
  e.amount_pennies,
  e.status,
  e.description,
  e.category,
  e.created_at,
  e.updated_at,
  e.student_id,
  sn.display_name as student_name,
  sn.full_name    as student_full_name
from teacher_expenses e
left join v_student_names sn
  on sn.student_id = e.student_id;


------------------------------------------------------------
-- Teacher expenses summary by month
------------------------------------------------------------
create or replace view public.v_teacher_expenses_summary as
select
  e.teacher_id,
  date_trunc('month', timezone('Europe/London', e.incurred_at))::date as month_start,
  sum(
    case
      when e.status = 'approved'::text then e.amount_pennies
      else 0
    end
  ) as approved_pennies,
  sum(
    case
      when e.status = 'pending'::text then e.amount_pennies
      else 0
    end
  ) as pending_pennies,
  sum(
    case
      when e.status = 'rejected'::text then e.amount_pennies
      else 0
    end
  ) as rejected_pennies
from teacher_expenses e
group by
  e.teacher_id,
  date_trunc('month', timezone('Europe/London', e.incurred_at))::date;


------------------------------------------------------------
-- Teacher last activity
------------------------------------------------------------
create or replace view public.v_teacher_last_activity as
select
  t.id as teacher_id,
  coalesce(
    max(l.occurred_at),
    t.created_at
  ) as last_activity_at
from teachers t
left join lessons l
  on l.teacher_id = t.id
 and l.state      = 'confirmed'::lesson_state
group by t.id, t.created_at;


------------------------------------------------------------
-- Teacher lesson earnings detail
------------------------------------------------------------
create or replace view public.v_teacher_lesson_earnings_detail as
select
  l.id          as lesson_id,
  l.teacher_id,
  l.student_id,
  l.occurred_at as start_at,
  l.duration_min,
  l.delivery,
  l.state,
  l.is_snc,
  l.snc_mode,
  str.student_tier,
  case
    when l.delivery = 'online'::delivery
      and str.effective_online_rate_pennies is not null
      then str.effective_online_rate_pennies
    when l.delivery = 'f2f'::delivery
      and str.effective_f2f_rate_pennies   is not null
      then str.effective_f2f_rate_pennies
    else null::integer
  end as hourly_rate_pennies,
  case
    when l.delivery = 'online'::delivery
      and str.effective_online_rate_pennies is not null
      then round((l.duration_min * str.effective_online_rate_pennies)::numeric / 60::numeric)::integer
    when l.delivery = 'f2f'::delivery
      and str.effective_f2f_rate_pennies   is not null
      then round((l.duration_min * str.effective_f2f_rate_pennies)::numeric / 60::numeric)::integer
    else null::integer
  end as gross_pennies
from lessons l
left join v_student_teacher_rate_summary str
  on str.student_id = l.student_id
 and str.teacher_id = l.teacher_id
where l.state = 'confirmed'::lesson_state;


------------------------------------------------------------
-- Teacher lesson earnings by month
------------------------------------------------------------
create or replace view public.v_teacher_lesson_earnings_by_month as
select
  d.teacher_id,
  date_trunc('month', timezone('Europe/London', d.start_at))::date as month_start,
  sum(d.duration_min)                                              as lesson_minutes_total,
  sum(d.gross_pennies)                                             as gross_pennies,
  sum(
    case
      when d.is_snc and d.snc_mode = 'free'::snc_mode then d.duration_min
      else 0
    end
  ) as snc_free_minutes,
  sum(
    case
      when d.is_snc and d.snc_mode = 'charged'::snc_mode then d.duration_min
      else 0
    end
  ) as snc_charged_minutes
from v_teacher_lesson_earnings_detail d
group by
  d.teacher_id,
  date_trunc('month', timezone('Europe/London', d.start_at))::date;


------------------------------------------------------------
-- Teacher lesson earnings by student + month
------------------------------------------------------------
create or replace view public.v_teacher_lesson_earnings_by_student_month as
select
  d.teacher_id,
  d.student_id,
  sn.display_name as student_name,
  date_trunc('month', timezone('Europe/London', d.start_at))::date as month_start,
  sum(d.duration_min) as lesson_minutes_total,
  sum(d.gross_pennies) as gross_pennies
from v_teacher_lesson_earnings_detail d
left join v_student_names sn
  on sn.student_id = d.student_id
group by
  d.teacher_id,
  d.student_id,
  sn.display_name,
  date_trunc('month', timezone('Europe/London', d.start_at))::date;


------------------------------------------------------------
-- Teacher lesson earnings last month
------------------------------------------------------------
create or replace view public.v_teacher_lesson_earnings_last_month as
with bounds as (
  select
    date_trunc('month', timezone('Europe/London', now()))::date as current_month_start
)
select
  e.teacher_id,
  e.month_start,
  e.lesson_minutes_total,
  e.gross_pennies,
  e.snc_free_minutes,
  e.snc_charged_minutes
from v_teacher_lesson_earnings_by_month e
join bounds b
  on e.month_start = (b.current_month_start - interval '1 mon')::date;


------------------------------------------------------------
-- Teacher lesson revenue by month
------------------------------------------------------------
create or replace view public.v_teacher_lesson_revenue_by_month as
select
  l.teacher_id,
  date_trunc('month', timezone('Europe/London', l.occurred_at))::date as month_start,
  sum(r.revenue_pennies) as revenue_pennies
from lessons l
join v_lesson_revenue_detail r
  on r.lesson_id = l.id
where l.state = 'confirmed'::lesson_state
group by
  l.teacher_id,
  date_trunc('month', timezone('Europe/London', l.occurred_at))::date;


------------------------------------------------------------
-- Teacher lesson margin by student + month
------------------------------------------------------------
create or replace view public.v_teacher_lesson_margin_by_student_month as
select
  m.teacher_id,
  m.student_id,
  sn.display_name as student_name,
  date_trunc('month', timezone('Europe/London', m.start_at))::date as month_start,
  sum(m.duration_min)           as lesson_minutes_total,
  sum(m.revenue_pennies)        as revenue_pennies,
  sum(m.teacher_earnings_pennies) as teacher_earnings_pennies,
  sum(m.revenue_pennies) - sum(m.teacher_earnings_pennies) as margin_pennies,
  case
    when sum(m.revenue_pennies) > 0 then
      (sum(m.revenue_pennies) - sum(m.teacher_earnings_pennies))::numeric * 100.0
      / sum(m.revenue_pennies)::numeric
    else null::numeric
  end as margin_pct
from v_lesson_margin_detail m
left join v_student_names sn
  on sn.student_id = m.student_id
group by
  m.teacher_id,
  m.student_id,
  sn.display_name,
  date_trunc('month', timezone('Europe/London', m.start_at))::date;


------------------------------------------------------------
-- Teacher lesson stats by month (counts + minutes + SNC)
------------------------------------------------------------
create or replace view public.v_teacher_lesson_stats_by_month as
select
  l.teacher_id,
  date_trunc('month', timezone('Europe/London', l.occurred_at))::date as month_start,
  count(*)                     as lesson_count_total,
  sum(l.duration_min)::integer as confirmed_minutes_total,
  sum(
    case
      when l.delivery = 'online'::delivery then l.duration_min
      else 0
    end
  )::integer as confirmed_minutes_online,
  sum(
    case
      when l.delivery = 'f2f'::delivery then l.duration_min
      else 0
    end
  )::integer as confirmed_minutes_f2f,
  count(*) filter (where l.is_snc and l.snc_mode = 'free'::snc_mode)    as snc_free_count,
  count(*) filter (where l.is_snc and l.snc_mode = 'charged'::snc_mode) as snc_charged_count
from lessons l
where l.state = 'confirmed'::lesson_state
group by
  l.teacher_id,
  date_trunc('month', timezone('Europe/London', l.occurred_at))::date;


------------------------------------------------------------
-- Teacher lessons (simple teacher-facing list)
------------------------------------------------------------
create or replace view public.v_teacher_lessons as
select
  l.id,
  l.teacher_id,
  l.student_id,
  l.occurred_at as start_at,
  l.duration_min,
  l.state,
  vs.display_name as student_name
from lessons l
left join v_student_names vs
  on vs.student_id = l.student_id;


------------------------------------------------------------
-- Teacher margin by month (names wrapper)
------------------------------------------------------------
create or replace view public.v_teacher_margin_by_month_with_names as
select
  tm.teacher_id,
  tm.month_start,
  tm.revenue_pennies,
  tm.lesson_minutes_total,
  tm.snc_free_minutes,
  tm.snc_charged_minutes,
  tm.teacher_earnings_pennies,
  tm.expenses_approved_pennies,
  tm.expenses_pending_pennies,
  tm.expenses_rejected_pennies,
  tm.margin_before_expenses_pennies,
  tm.margin_after_expenses_pennies,
  tm.margin_before_expenses_pct,
  tm.margin_after_expenses_pct,
  tn.display_name as teacher_name,
  tn.full_name    as teacher_full_name
from v_teacher_margin_by_month tm
left join v_teacher_names tn
  on tn.teacher_id = tm.teacher_id;


------------------------------------------------------------
-- Teacher names (full + display)
------------------------------------------------------------
create or replace view public.v_teacher_names as
select
  t.id as teacher_id,
  p.full_name,
  coalesce(p.preferred_name, p.full_name) as display_name
from teachers t
join profiles p
  on p.id = t.profile_id;


------------------------------------------------------------
-- Teacher rate summary (per teacher overview)
------------------------------------------------------------
create or replace view public.v_teacher_rate_summary as
with override_agg as (
  select
    o.teacher_id,
    count(*)                         as num_f2f_overrides,
    min(o.f2f_rate_pennies)         as min_override_rate_pennies,
    max(o.f2f_rate_pennies)         as max_override_rate_pennies
  from teacher_student_f2f_overrides o
  group by o.teacher_id
)
select
  t.id as teacher_id,
  tr.default_online_rate_pennies,
  tr.f2f_basic_rate_pennies,
  tr.f2f_premium_rate_pennies,
  coalesce(oa.num_f2f_overrides, 0::bigint) as num_f2f_overrides,
  oa.min_override_rate_pennies,
  oa.max_override_rate_pennies
from teachers t
left join teacher_rates tr
  on tr.teacher_id = t.id
left join override_agg oa
  on oa.teacher_id = t.id;


------------------------------------------------------------
-- Teacher usage last 3 months
------------------------------------------------------------
create or replace view public.v_teacher_usage_last_3m as
with monthly as (
  select
    l.teacher_id,
    date_trunc('month', l.occurred_at) as month_start,
    sum(l.duration_min)::integer       as minutes_taken
  from lessons l
  where l.state = 'confirmed'::lesson_state
    and l.occurred_at >= date_trunc('month', now() - interval '3 mons')
  group by
    l.teacher_id,
    date_trunc('month', l.occurred_at)
),
agg as (
  select
    m.teacher_id,
    count(*)             as months_count,
    sum(m.minutes_taken) as minutes_last_3m,
    avg(m.minutes_taken) as avg_month_minutes
  from monthly m
  group by m.teacher_id
)
select
  a.teacher_id,
  coalesce(a.avg_month_minutes, 0::numeric) / 60.0 as avg_month_hours,
  (coalesce(a.avg_month_minutes, 0::numeric) / 60.0) > 10.0 as is_heavy_user
from agg a;
