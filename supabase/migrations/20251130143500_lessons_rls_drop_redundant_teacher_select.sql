-- RLS cleanup: drop redundant teacher SELECT policy on lessons

begin;

drop policy if exists "teachers read own lessons" on public.lessons;

commit;
