create table if not exists public.shows (
  id text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  tagline text not null default '',
  category text not null default '',
  format text not null default '',
  audience text not null default '',
  publishing_cadence text not null default '',
  intro_style text not null default '',
  outro_style text not null default '',
  template text not null default 'news-breakdown',
  persona_mode text not null default 'reality-mode',
  conflict_level text not null default 'medium',
  host_a_id text not null,
  host_b_id text not null,
  updated_at timestamptz not null default now()
);

create index if not exists shows_updated_at_idx on public.shows (updated_at desc);
create index if not exists shows_user_id_idx on public.shows (user_id);
