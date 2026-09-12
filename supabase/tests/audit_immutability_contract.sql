-- Run with a database-administrator connection after applying migrations.
-- The contract is intentionally metadata-only; no audit rows are modified.
begin;

do $$
declare
  function_name text;
  is_security_definer boolean;
begin
  if has_table_privilege('authenticated', 'public.crm_opportunity_events', 'INSERT') then
    raise exception 'Opportunity audit events must not be insertable by authenticated clients';
  end if;
  if has_table_privilege('authenticated', 'public.crm_opportunity_events', 'UPDATE') then
    raise exception 'Opportunity audit events must not be updateable by authenticated clients';
  end if;
  if has_table_privilege('authenticated', 'public.crm_opportunity_events', 'DELETE') then
    raise exception 'Opportunity audit events must not be deletable by authenticated clients';
  end if;

  if has_table_privilege('authenticated', 'public.crm_task_events', 'INSERT') then
    raise exception 'Task audit events must not be insertable by authenticated clients';
  end if;
  if has_table_privilege('authenticated', 'public.crm_note_events', 'INSERT') then
    raise exception 'Note audit events must not be insertable by authenticated clients';
  end if;

  foreach function_name in ARRAY ARRAY[
    'crm_log_opportunity_created()',
    'crm_log_task_change()',
    'crm_assign_event_actor()',
    'crm_assign_note_event_actor()'
  ] loop
    select p.prosecdef
    into is_security_definer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname || '()') = function_name;

    if not coalesce(is_security_definer, false) then
      raise exception 'Audit trigger function % must be SECURITY DEFINER', function_name;
    end if;
  end loop;
end;
$$;

rollback;