-- Update rpc_admin_create_student to use explicit search_path
-- and support nullable tier (basic | premium | elite | NULL = legacy/no tier yet).

drop function if exists public.rpc_admin_create_student(
  uuid,            -- p_auth_user_id
  text,            -- p_full_name
  text,            -- p_preferred_name
  text,            -- p_timezone
  tier,            -- p_tier (enum: basic | premium | elite)
  uuid             -- p_teacher_id
);

create or replace function public.rpc_admin_create_student(
  p_auth_user_id   uuid,
  p_full_name      text,
  p_preferred_name text default null,
  p_timezone       text default 'Europe/London',
  p_tier           tier default null,
  p_teacher_id     uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
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
  -- p_tier may be NULL => interpreted as "legacy / no tier yet" by the UI
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
$function$;
