-- Enable Realtime for the driver_profiles table
begin;
  -- Create the publication if it doesn't exist (it should, but safety first)
  do $$
  begin
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
      create publication supabase_realtime;
    end if;
  end $$;
  
  -- Add the driver_profiles table to the publication
  do $$
  begin
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' 
      and schemaname = 'public' 
      and tablename = 'driver_profiles'
    ) then
      alter publication supabase_realtime add table public.driver_profiles;
    end if;
  end $$;
commit;

-- Set replica identity to FULL so that updates contain all columns needed for the Frontend hooks
alter table public.driver_profiles replica identity full;
