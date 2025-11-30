-- RLS: teachers read own lessons -> authenticated-only

begin;

alter policy "teachers read own lessons"
on public.lessons
to authenticated
using (
  exists (
    select 1
    from teachers t
    where t.id = lessons.teacher_id
      and t.profile_id = auth.uid()
  )
);

commit;
