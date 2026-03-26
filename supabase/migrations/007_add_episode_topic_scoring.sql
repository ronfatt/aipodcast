alter table public.episodes
add column if not exists topic_score jsonb,
add column if not exists topic_rewrites text[];
