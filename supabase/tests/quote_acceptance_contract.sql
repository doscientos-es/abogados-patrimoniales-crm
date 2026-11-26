-- Run with a database-administrator connection after all migrations.
do $$
declare
  acceptance_function oid := 'public.crm_public_quote_acceptance(text)'::regprocedure;
  old_accept_function oid := 'public.crm_public_accept_quote(text, text, boolean, text)'::regprocedure;
  accept_function oid := 'public.crm_public_accept_quote_verified(text, text, boolean, text, text)'::regprocedure;
  prepare_function oid := 'public.crm_prepare_quote_verification(text)'::regprocedure;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.crm_quote_acceptance_links'::regclass) then
    raise exception 'Acceptance links must have row-level security enabled';
  end if;
  if has_table_privilege('anon', 'public.crm_quote_acceptance_links', 'SELECT')
    or has_table_privilege('anon', 'public.crm_quote_acceptance_links', 'INSERT') then
    raise exception 'Anonymous callers must not access acceptance-link rows directly';
  end if;
  if has_table_privilege('authenticated', 'public.crm_quote_acceptance_links', 'INSERT')
    or has_table_privilege('authenticated', 'public.crm_quote_acceptance_links', 'UPDATE')
    or has_table_privilege('authenticated', 'public.crm_quote_acceptance_links', 'DELETE') then
    raise exception 'Firm users must mutate acceptance links only through guarded functions';
  end if;
  if not has_function_privilege('anon', acceptance_function, 'EXECUTE')
    or not has_function_privilege('anon', accept_function, 'EXECUTE') then
    raise exception 'The public token-scoped RPCs must be executable by anonymous callers';
  end if;
  if has_function_privilege('anon', old_accept_function, 'EXECUTE')
    or has_function_privilege('authenticated', old_accept_function, 'EXECUTE')
    or has_function_privilege('anon', prepare_function, 'EXECUTE')
    or has_function_privilege('authenticated', prepare_function, 'EXECUTE')
    or not has_function_privilege('service_role', prepare_function, 'EXECUTE') then
    raise exception 'Verification must not be bypassable or expose codes to public callers';
  end if;
  if has_table_privilege('anon', 'public.crm_quote_acceptance_verification', 'SELECT')
    or has_table_privilege('authenticated', 'public.crm_quote_acceptance_verification', 'SELECT') then
    raise exception 'Verification secrets must not be accessible directly';
  end if;
  if not (select prosecdef from pg_proc where oid = acceptance_function)
    or not (select prosecdef from pg_proc where oid = accept_function) then
    raise exception 'Public acceptance RPCs must run with their restricted definer privileges';
  end if;
  if (select is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'crm_onboardings' and column_name = 'proforma_sent_on') <> 'YES' then
    raise exception 'An onboarding created before sending its proforma must allow a null sent date';
  end if;
  if position('extensions.digest' in pg_get_functiondef(acceptance_function)) = 0
    or position('extensions.digest' in pg_get_functiondef(accept_function)) = 0 then
    raise exception 'Public RPCs must compare the presented token using its SHA-256 hash';
  end if;
  if position('snapshot' in pg_get_functiondef(acceptance_function)) = 0
    or position($needle$- 'instantanea'$needle$ in pg_get_functiondef(acceptance_function)) = 0 then
    raise exception 'The public quote snapshot must not expose the internal client contact details';
  end if;
end;
$$;
