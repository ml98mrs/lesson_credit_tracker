-- Stage 5: rpc_log_lesson
-- - switch to SECURITY INVOKER
-- - enforce teacher↔student assignment inline (defence in depth)

begin;

create or replace function public.rpc_log_lesson(
  p_student_id   uuid,
  p_occurred_at  timestamptz,
  p_duration_min integer,
  p_delivery     delivery,
  p_is_snc       boolean default false,
  p_notes        text    default null
)
returns jsonb
language plpgsql
security invoker
set search_path to 'public'
as $function$
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
$function$;

commit;
