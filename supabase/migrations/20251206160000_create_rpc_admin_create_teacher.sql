-- Create rpc_admin_create_teacher to provision a teacher profile + teacher row
-- Mirrors rpc_admin_create_student but targets the teachers table
set check_function_bodies = off;

create or replace function public.rpc_admin_create_teacher(
  p_auth_user_id   uuid,
  p_full_name      text,
  p_preferred_name text,
  p_timezone       text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
begin
  --------------------------------------------------------------------
  -- 1) Update existing profile row created by auth trigger
  --------------------------------------------------------------------
  update public.profiles
  set
    full_name      = p_full_name,
    preferred_name = nullif(p_preferred_name, ''),
    timezone       = coalesce(p_timezone, 'Europe/London'),
    role           = 'teacher'
  where id = p_auth_user_id;

  if not found then
    raise exception
      'rpc_admin_create_teacher: no profile row found for auth_user_id=%',
      p_auth_user_id;
  end if;

  --------------------------------------------------------------------
  -- 2) Create teacher row
  --    (one-to-one with profiles via profile_id)
  --------------------------------------------------------------------
  insert into public.teachers (profile_id)
  values (p_auth_user_id)
  returning id into v_teacher_id;

  return v_teacher_id;
end;
$$;

-- (Optional) Grant execute if you ever call this outside service-role.
-- For now, you’re calling via getAdminSupabase (service role), so this
-- isn’t strictly necessary:
-- grant execute on function public.rpc_admin_create_teacher(
--   uuid, text, text, text
-- ) to authenticated;
