-- Enable Realtime for the driver_locations table so the Server/Admins can watch coordinates ping live.
begin;
  do $$
  begin
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' 
      and schemaname = 'public' 
      and tablename = 'driver_locations'
    ) then
      alter publication supabase_realtime add table public.driver_locations;
    end if;
  end $$;
commit;

-- Set replica identity to FULL so the payload always contains coordinates on update events.
alter table public.driver_locations replica identity full;
