alter table public.episodes
  add column if not exists applied_recommendation jsonb;
