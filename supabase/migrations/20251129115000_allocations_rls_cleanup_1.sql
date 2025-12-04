begin;

alter table public.allocations enable row level security;

drop policy if exists "allocations select" on public.allocations;

create policy "allocations select" on public.allocations
for select
to public
using (
  -- Admins see everything
  auth_is_admin()

  -- TEACHER: see allocations for lessons you taught
  OR exists (
    select 1
    from lessons l
    join teachers t on t.id = l.teacher_id
    where l.id = allocations.lesson_id
      and t.profile_id = auth.uid()
  )

  -- STUDENT: see allocations for lessons you attended
  OR exists (
    select 1
    from lessons l
    join students s on s.id = l.student_id
    where l.id = allocations.lesson_id
      and s.profile_id = auth.uid()
  )

  -- STUDENT: see allocations on your own credit lots
  OR exists (
    select 1
    from credit_lots cl
    join students s on s.id = cl.student_id
    where cl.id = allocations.credit_lot_id
      and s.profile_id = auth.uid()
  )
);

commit;
