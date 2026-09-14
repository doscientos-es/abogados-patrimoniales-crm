-- Run with a database-administrator connection after all migrations.
do $$
begin
  if not exists (
    select 1 from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_trgm' and n.nspname = 'extensions'
  ) then
    raise exception 'pg_trgm must be installed outside the public schema';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and policyname in (
        'crm_case_document_events_read',
        'crm task labels members read',
        'crm label assignments members manage',
        'crm title templates members read',
        'crm practice areas members read'
      )
      and coalesce(qual, '') !~* E'select[[:space:]]+auth\\.uid\\(\\)'
  ) then
    raise exception 'RLS identity must be evaluated once per query';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and policyname in (
        'crm_firms_require_mfa_update',
        'crm_firm_settings_require_mfa_insert',
        'crm_firm_settings_require_mfa_update'
      )
  ) or to_regprocedure('public.crm_is_aal2()') is not null then
    raise exception 'Administrative changes must not require MFA';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_drive_connections'
      and (policyname = 'crm_drive_connections_manage' or cmd = 'ALL')
  ) or 3 <> (
    select count(*) from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_drive_connections'
      and policyname in (
        'crm_drive_connections_insert',
        'crm_drive_connections_update',
        'crm_drive_connections_delete'
      )
  ) then
    raise exception 'Drive connection writes must use explicit, non-overlapping policies';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  ) then
    raise exception 'Every public table must have RLS enabled';
  end if;

  if exists (
    select 1
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where con.contype = 'f' and n.nspname = 'public'
      and not exists (
        select 1 from pg_index i
        where i.indrelid = con.conrelid and i.indisvalid and i.indpred is null
          and (i.indkey::smallint[])[0:array_length(con.conkey, 1) - 1] = con.conkey
      )
  ) then
    raise exception 'Every public foreign key must have a covering index';
  end if;
end;
$$;