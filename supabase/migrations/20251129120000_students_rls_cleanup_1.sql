begin;

alter table public.students enable row level security;

-- Drop old overlapping SELECT policies
drop policy if exists "students read own or admin" on public.students;
drop policy if exists "students readable (self/admin/assigned-teacher)" on public.students;
drop policy if exists "teacher can read their students" on public.students;

-- Also drop any previous unified policy
drop policy if exists "students select" on public.students;

-- Admin full control
drop policy if exists "students admin write" on public.students;
create policy "students admin write" on public.students
for all
to public
using (auth_is_admin())
with check (auth_is_admin());

-- Single unified SELECT policy
create policy "students select" on public.students
for select
to public
using (
  -- Admin: everything
  auth_is_admin()

  -- Student: their own student row
  OR students.profile_id = auth.uid()

  -- Teacher: students they teach
  OR exists (
    select 1
    from student_teacher st
    join teachers t on t.id = st.teacher_id
    where st.student_id = students.id
      and t.profile_id = auth.uid()
  )
);

commit;