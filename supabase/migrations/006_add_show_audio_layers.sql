do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'shows'
  ) then
    alter table public.shows
      add column if not exists background_music_url text,
      add column if not exists background_music_level text,
      add column if not exists intro_sting_url text,
      add column if not exists outro_sting_url text;
  end if;
end $$;
