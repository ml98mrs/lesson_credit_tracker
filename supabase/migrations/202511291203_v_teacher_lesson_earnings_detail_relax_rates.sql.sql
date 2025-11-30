begin;

create or replace view public.v_teacher_lesson_earnings_detail as
select
  l.id as lesson_id,
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
         and str.effective_f2f_rate_pennies is not null
      then str.effective_f2f_rate_pennies
    else null::integer
  end as hourly_rate_pennies,
  case
    when l.delivery = 'online'::delivery
         and str.effective_online_rate_pennies is not null
      then round(
        (l.duration_min * str.effective_online_rate_pennies)::numeric
        / 60::numeric
      )::integer
    when l.delivery = 'f2f'::delivery
         and str.effective_f2f_rate_pennies is not null
      then round(
        (l.duration_min * str.effective_f2f_rate_pennies)::numeric
        / 60::numeric
      )::integer
    else null::integer
  end as gross_pennies
from lessons l
left join v_student_teacher_rate_summary str
  on str.student_id = l.student_id
 and str.teacher_id = l.teacher_id
where l.state = 'confirmed'::lesson_state;

commit;
