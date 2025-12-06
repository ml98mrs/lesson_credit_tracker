-- Pass B: make v_student_lessons a security INVOKER view
-- and standardise its definition.

create or replace view public.v_student_lessons as
with
  lesson_allocs as (
    select
      a.lesson_id,
      string_agg(
        (
          (
            case cl.source_type
              when 'overdraft'::text then 'Overdraft'::text
              when 'invoice'::text then coalesce(cl.external_ref, 'Invoice credit'::text)
              when 'award'::text then coalesce(
                'Award: '::text || cl.award_reason_code,
                'Award credit'::text
              )
              when 'adjustment'::text then 'Adjustment'::text
              else cl.source_type
            end || ' ('::text
          ) || a.minutes_allocated::text
        ) || ' min)'::text,
        ', '::text
        order by
          cl.source_type,
          cl.start_date nulls first,
          cl.id
      ) as allocation_summary
    from
      allocations a
      join credit_lots cl on cl.id = a.credit_lot_id
    group by
      a.lesson_id
  )
select
  l.id as lesson_id,
  l.student_id,
  l.teacher_id,
  p.full_name as teacher_full_name,
  l.occurred_at,
  l.duration_min,
  l.delivery,
  l.length_cat,
  l.is_snc,
  l.snc_mode,
  l.state,
  l.created_at,
  la.allocation_summary
from
  lessons l
  left join teachers t on t.id = l.teacher_id
  left join profiles p on p.id = t.profile_id
  left join lesson_allocs la on la.lesson_id = l.id;

-- Important: flip to security INVOKER so RLS of the caller is used.
alter view public.v_student_lessons
  set (security_invoker = true);
