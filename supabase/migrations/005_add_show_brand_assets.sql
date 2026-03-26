do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'shows'
  ) then
    alter table public.shows
      add column if not exists cover_image_url text,
      add column if not exists default_intro text,
      add column if not exists default_outro text,
      add column if not exists default_description text;
  end if;
end $$;
