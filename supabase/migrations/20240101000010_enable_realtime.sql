-- Enable Realtime for the orders table
begin;
  -- Create the publication if it doesn't exist
  do $$
  begin
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
      create publication supabase_realtime;
    end if;
  end $$;
  
  -- Add the orders table to the publication
  -- Use a separate DO block to safely add the table if it's not already there
  do $$
  begin
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' 
      and schemaname = 'public' 
      and tablename = 'orders'
    ) then
      alter publication supabase_realtime add table public.orders;
    end if;
  end $$;
commit;

-- Set replica identity to FULL so that updates/deletes contain all columns (needed for filtering)
alter table public.orders replica identity full;
