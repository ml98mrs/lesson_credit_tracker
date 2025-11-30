begin;

insert into public.award_reasons (code, label) values
  ('free_cancellation', 'Free cancellation'),
  ('goodwill',         'Goodwill'),
  ('promo',            'Promo'),
  ('trial',            'Trial')
on conflict (code) do nothing;

commit;
