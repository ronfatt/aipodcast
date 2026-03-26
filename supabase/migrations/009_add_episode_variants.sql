alter table public.episodes
  add column if not exists variants jsonb;
