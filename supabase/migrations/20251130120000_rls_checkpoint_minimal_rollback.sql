-- RLS checkpoint: minimal rollback state (teacher + student portals stable, no recursion)

-- 1) teacher_invoices — RLS on, own-only access for teachers
alter table teacher_invoices enable row level security;

drop policy if exists "teacher_invoices select own" on teacher_invoices;
drop policy if exists "teacher_invoices insert own" on teacher_invoices;
drop policy if exists "teacher_invoices delete own draft" on teacher_invoices;

create policy "teacher_invoices select own"
on teacher_invoices
for select
to authenticated
using (
  teacher_id in (
    select t.id
    from teachers t
    where t.profile_id = auth.uid()
  )
);

create policy "teacher_invoices insert own"
on teacher_invoices
for insert
to authenticated
with check (
  teacher_id in (
    select t.id
    from teachers t
    where t.profile_id = auth.uid()
  )
);

create policy "teacher_invoices delete own draft"
on teacher_invoices
for delete
to authenticated
using (
  status = 'draft'
  and teacher_id in (
    select t.id
    from teachers t
    where t.profile_id = auth.uid()
  )
);

------------------------------------------------------------
-- 2) teacher_rates — RLS on, teachers can only see own rates
alter table teacher_rates enable row level security;

drop policy if exists "teacher_rates select own" on teacher_rates;

create policy "teacher_rates select own"
on teacher_rates
for select
to authenticated
using (
  teacher_id in (
    select t.id
    from teachers t
    where t.profile_id = auth.uid()
  )
);

------------------------------------------------------------
-- 3) teacher_student_f2f_overrides — admin-only
alter table teacher_student_f2f_overrides enable row level security;
-- no policies: service-role/admin only

------------------------------------------------------------
-- 4) student_teacher — RLS on, teachers can read own links
alter table student_teacher enable row level security;

drop policy if exists "student_teacher readable (admin/teacher/self)" on student_teacher;
drop policy if exists "student_teacher readable" on student_teacher;
drop policy if exists "student_teacher teachers read own" on student_teacher;

create policy "student_teacher teachers read own"
on student_teacher
for select
to authenticated
using (
  teacher_id in (
    select t.id
    from teachers t
    where t.profile_id = auth.uid()
  )
);

------------------------------------------------------------
-- 5) students — admin write; students see self; teachers see assigned students
alter table students enable row level security;

drop policy if exists "students admin write" on students;
create policy "students admin write"
on students
for all
to public
using (auth_is_admin())
with check (auth_is_admin());

drop policy if exists "students select minimal" on students;
drop policy if exists "students select for teachers" on students;

create policy "students select minimal"
on students
for select
to authenticated
using (
  auth_is_admin()
  or profile_id = auth.uid()
);

create policy "students select for teachers"
on students
for select
to authenticated
using (
  id in (
    select st.student_id
    from student_teacher st
    join teachers t on t.id = st.teacher_id
    where t.profile_id = auth.uid()
  )
);

------------------------------------------------------------
-- 6) teachers — teacher sees own row; admin sees all
alter table teachers enable row level security;

drop policy if exists "any_authenticated_can_select_teachers" on teachers;
drop policy if exists "teachers_can_select_self" on teachers;
drop policy if exists "teachers select for linked students" on teachers;
drop policy if exists "teachers read own or admin" on teachers;

create policy "teachers read own or admin"
on teachers
for select
to public
using (
  profile_id = auth.uid()
  or auth_is_admin()
);

------------------------------------------------------------
-- 7) profiles — remove recursive policy; keep existing broad read for now
alter table profiles enable row level security;

drop policy if exists "profiles read assigned students for teacher" on profiles;
-- keep:
--   any_authenticated_can_select_profiles
--   profiles self read
--   profiles self update
