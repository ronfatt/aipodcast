alter table public.episodes
add column if not exists clips jsonb;
