-- 20251206120000_add_is_low_remaining_to_v_credit_lot_remaining.sql
-- Purpose: add a DB-driven "is_low_remaining" flag to v_credit_lot_remaining
-- Domain rule: "low lot" = minutes_remaining <= 360 (6 hours)

create or replace view public.v_credit_lot_remaining as
with
  lot_allocations as (
    select
      a.credit_lot_id,
      coalesce(sum(a.minutes_allocated), 0::bigint) as minutes_allocated
    from
      allocations a
    group by
      a.credit_lot_id
  ),
  lot_with_usage as (
    select
      cl.id as credit_lot_id,
      cl.student_id,
      cl.source_type,
      cl.award_reason_code,
      cl.external_ref,
      cl.minutes_granted,
      coalesce(la.minutes_allocated, 0::bigint)::integer as minutes_allocated,
      (
        cl.minutes_granted - coalesce(la.minutes_allocated, 0::bigint)
      )::integer as minutes_remaining,
      (
        cl.minutes_granted - coalesce(la.minutes_allocated, 0::bigint)
      ) < 0 as is_overdrawn,
      cl.delivery_restriction,
      cl.tier_restriction,
      cl.length_restriction,
      cl.start_date,
      cl.expiry_policy,
      cl.expiry_date,
      cl.state,
      cl.created_at
    from
      credit_lots cl
      left join lot_allocations la on la.credit_lot_id = cl.id
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
  created_at,
  -- New: per-lot "low remaining" flag (generic 6h rule)
  (minutes_remaining <= 360) as is_low_remaining
from
  lot_with_usage;
