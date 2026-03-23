create table if not exists public.episodes (
  id text primary key,
  title text not null,
  show_name text not null,
  summary text not null,
  show_notes jsonb not null default '[]'::jsonb,
  cta text not null default '',
  source_type text not null,
  source_content text not null,
  template text not null,
  duration_label text not null,
  status text not null,
  updated_at timestamptz not null default now(),
  host_a jsonb not null,
  host_b jsonb not null,
  script jsonb not null,
  audio_url text,
  export_package_url text,
  generation_mode text
);

create index if not exists episodes_updated_at_idx on public.episodes (updated_at desc);
