alter table public.episodes
add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists episodes_user_id_idx on public.episodes (user_id);
