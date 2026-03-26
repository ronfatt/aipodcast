alter table public.episodes
  add column if not exists analytics jsonb;
