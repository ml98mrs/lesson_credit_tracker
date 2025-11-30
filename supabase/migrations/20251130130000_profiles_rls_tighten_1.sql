-- Tighten profiles RLS:
-- 1) any_authenticated_can_select_profiles -> admins only
-- 2) allow teachers to select their assigned students' profiles

begin;

alter policy "any_authenticated_can_select_profiles"
on public.profiles
to authenticated
using (auth_is_admin());

drop policy if exists "profiles select for teachers" on public.profiles;

create policy "profiles select for teachers"
on public.profiles
as permissive
for select
to authenticated
using (
  role = 'student'
  and id in (
    select s.profile_id
    from students s
    where s.id in (
      select st.student_id
      from student_teacher st
      join teachers t on t.id = st.teacher_id
      where t.profile_id = auth.uid()
    )
  )
);

commit;
