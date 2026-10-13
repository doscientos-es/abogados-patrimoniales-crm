do $$
declare
  table_name text;
  rls_enabled boolean;
  policy_count integer;
  index_definition text;
  function_definition text;
  function_security_definer boolean;
  table_names text[] := array[
    'crm_quote_services',
    'crm_engagement_blocks',
    'crm_quote_email_templates'
  ];
begin
  foreach table_name in array table_names loop
    select c.relrowsecurity into rls_enabled
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = table_name;
    if rls_enabled is distinct from true then
      raise exception 'RLS must be enabled on public.%', table_name;
    end if;

    select count(*) into policy_count
    from pg_policies p
    where p.schemaname = 'public' and p.tablename = table_name
      and p.roles @> array['authenticated']::name[];
    if policy_count <> 2 then
      raise exception 'Expected member-read and manager-write policies on public.%', table_name;
    end if;

    if has_table_privilege('anon', format('public.%I', table_name), 'SELECT') then
      raise exception 'Anonymous users must not read public.%', table_name;
    end if;
  end loop;

  select indexdef into index_definition from pg_indexes
  where schemaname = 'public' and indexname = 'crm_quote_services_firm_code_idx';
  if index_definition is null
    or position('UNIQUE' in upper(index_definition)) = 0
    or position('LOWER' in upper(index_definition)) = 0
    or position('TRIM' in upper(index_definition)) = 0
    or position('CODE' in upper(index_definition)) = 0 then
    raise exception 'Quote service codes must be unique per firm after normalization';
  end if;

  select indexdef into index_definition from pg_indexes
  where schemaname = 'public' and indexname = 'crm_quote_email_templates_one_default_idx';
  if index_definition is null
    or position('UNIQUE' in upper(index_definition)) = 0
    or position('IS_DEFAULT' in upper(index_definition)) = 0 then
    raise exception 'Each firm may have at most one active default email template';
  end if;

  select p.prosecdef into function_security_definer
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'crm_set_default_quote_template'
    and p.pronargs = 1;
  if function_security_definer is distinct from false then
    raise exception 'Default-template RPC must remain SECURITY INVOKER';
  end if;
  select pg_get_functiondef(p.oid) into function_definition
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'crm_set_default_quote_template'
    and p.pronargs = 1;
  if position('ORDER BY ID' in upper(function_definition)) = 0
    or position('CRM_QUOTE_EMAIL_TEMPLATES' in upper(function_definition)) = 0 then
    raise exception 'Default-template RPC must lock template rows in a stable order';
  end if;
  if has_function_privilege('anon', 'public.crm_set_default_quote_template(uuid)', 'EXECUTE') then
    raise exception 'Anonymous users must not execute the default-template RPC';
  end if;
end;
$$;
