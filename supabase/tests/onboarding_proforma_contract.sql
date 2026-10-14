do $$
declare
  function_definition text;
  security_definer boolean;
begin
  select pg_get_functiondef(p.oid), p.prosecdef
  into function_definition, security_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'crm_register_onboarding_proforma_sent'
    and p.pronargs = 3;

  if function_definition is null or security_definer is distinct from true then
    raise exception 'Proforma registration must use the guarded SECURITY DEFINER RPC';
  end if;
  if function_definition not ilike '%crm_is_firm_member%'
    or function_definition not ilike '%auth.uid()%'
    or function_definition not ilike '%for update%' then
    raise exception 'Proforma registration must check membership and lock the onboarding row';
  end if;
  if function_definition not ilike '%target_expected_version%'
    or function_definition not ilike '%proforma_sent_on%'
    or function_definition not ilike '%proforma_sent_registered%' then
    raise exception 'Proforma registration must be versioned and auditable';
  end if;
  if has_function_privilege('anon', 'public.crm_register_onboarding_proforma_sent(uuid,integer,date)', 'EXECUTE') then
    raise exception 'Anonymous users must not execute proforma registration';
  end if;
  if not has_function_privilege('authenticated', 'public.crm_register_onboarding_proforma_sent(uuid,integer,date)', 'EXECUTE') then
    raise exception 'Authenticated members must be able to execute proforma registration';
  end if;
end;
$$;