alter table public.episodes
add column if not exists show_id text references public.shows (id) on delete set null;

create index if not exists episodes_show_id_idx on public.episodes (show_id);

update public.episodes as episodes
set show_id = shows.id
from public.shows as shows
where episodes.show_id is null
  and episodes.show_name = shows.name
  and episodes.user_id is not distinct from shows.user_id;
