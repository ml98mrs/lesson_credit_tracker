-- Enable RLS on timezones and allow public read
-- Safe if already enabled / already has the policy.

alter table public.timezones enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'timezones'
      and policyname = 'Public read access to timezones'
  ) then
    create policy "Public read access to timezones"
      on public.timezones
      for select
      using (true);
  end if;
end
$$;
