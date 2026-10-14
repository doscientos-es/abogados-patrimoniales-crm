-- Run with a database-administrator connection after all migrations.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['crm_opportunities', 'crm_onboardings', 'crm_cases'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      raise exception 'Table % is missing from supabase_realtime', table_name;
    end if;
  end loop;
end;
$$;