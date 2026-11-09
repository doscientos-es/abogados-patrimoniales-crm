-- LOCAL DISPOSABLE DATABASE ONLY, after applying migrations. Never run on a remote project.
-- psql -X -v ON_ERROR_STOP=1 -f supabase/tests/mcp-readonly.sql
-- All fixture writes roll back; sequences may advance. Run as the local postgres role.
begin;
create function pg_temp.assert_mcp(condition boolean, message text) returns void
language plpgsql as $$ begin
  if condition is distinct from true then raise exception 'MCP regression: %', message; end if;
end; $$;

do $$
declare
  actor uuid := gen_random_uuid(); other_actor uuid := gen_random_uuid();
  firm uuid := gen_random_uuid(); other_firm uuid := gen_random_uuid();
  contact uuid := gen_random_uuid(); other_contact uuid := gen_random_uuid();
  own_case uuid := gen_random_uuid(); hidden_case uuid := gen_random_uuid();
  lead uuid := gen_random_uuid(); foreign_lead uuid := gen_random_uuid();
  key_result jsonb; token text; scoped_token text; result jsonb;
  saved_claims text; saved_sub text;
begin
  insert into auth.users(id, email) values(actor, actor::text || '@mcp.invalid'), (other_actor, other_actor::text || '@mcp.invalid');
  insert into public.crm_firms(id, name) values(firm, 'MCP fixture'), (other_firm, 'Other MCP fixture');
  insert into public.crm_firm_members(firm_id, user_id, role, status)
    values(firm, actor, 'paralegal', 'active'), (firm, other_actor, 'owner', 'active'), (other_firm, other_actor, 'owner', 'active');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', other_actor, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', other_actor::text, true);
  insert into public.crm_contacts(id, firm_id, nature, relationship, display_name)
    values(contact, firm, 'person', 'lead', 'MCP contact'), (other_contact, other_firm, 'person', 'lead', 'Foreign contact');
  insert into public.crm_opportunities(id, firm_id, contact_id, title)
    values(lead, firm, contact, 'MCP lead'), (foreign_lead, other_firm, other_contact, 'Foreign lead');
  insert into public.crm_cases(id, firm_id, primary_contact_id, case_number, title, nature, assigned_to)
    values(own_case, firm, contact, 901, 'Assigned case', 'extrajudicial', actor),
      (hidden_case, firm, contact, 902, 'Unassigned case', 'extrajudicial', other_actor);
  insert into public.crm_case_documents(firm_id, case_id, name, original_name, storage_path, mime_type, size_bytes, confidentiality, content_status)
    values(firm, own_case, 'Visible', 'Visible.pdf', firm::text || '/fixture-visible', 'application/pdf', 10, 'normal', 'validated'),
      (firm, own_case, 'Restricted', 'Restricted.pdf', firm::text || '/fixture-restricted', 'application/pdf', 10, 'restricted', 'validated'),
      (firm, hidden_case, 'Hidden', 'Hidden.pdf', firm::text || '/fixture-hidden', 'application/pdf', 10, 'normal', 'validated');

  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  key_result := public.crm_mcp_create_key(firm, 'Fixture', array['leads:read','contacts:read','cases:read','documents:read'], now() + interval '1 day');
  token := key_result->>'token';
  scoped_token := public.crm_mcp_create_key(firm, 'Limited', array['leads:read'], now() + interval '1 day')->>'token';
  perform pg_temp.assert_mcp(not exists(select 1 from lex_mcp.credentials where token_hash = token), 'plaintext is not stored');
  perform pg_temp.assert_mcp(not (public.crm_mcp_list_keys(firm)::text like '%' || token || '%'), 'list never exposes tokens');
  perform pg_temp.assert_mcp(not has_function_privilege('anon', 'public.crm_mcp_create_key(uuid,text,text[],timestamptz)', 'execute'), 'anon cannot issue keys');
  perform pg_temp.assert_mcp(not has_function_privilege('anon', 'public.crm_mcp_revoke_key(uuid)', 'execute'), 'anon cannot revoke keys');
  perform pg_temp.assert_mcp(not has_table_privilege('anon', 'lex_mcp.credentials', 'select'), 'anon cannot read hashes');
  perform pg_temp.assert_mcp(not has_table_privilege('authenticated', 'lex_mcp.audit', 'insert'), 'clients cannot forge audit');

  -- Simulate an anonymous gateway. The only identity used for reads must come from the key.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  saved_claims := current_setting('request.jwt.claims'); saved_sub := current_setting('request.jwt.claim.sub');
  result := public.crm_mcp_read(token, 'lex_whoami');
  perform pg_temp.assert_mcp(result#>>'{data,userId}' = actor::text, 'key binds user');
  perform pg_temp.assert_mcp(result#>>'{data,firmId}' = firm::text, 'key binds firm');
  perform pg_temp.assert_mcp(current_setting('request.jwt.claims') = saved_claims and current_setting('request.jwt.claim.sub') = saved_sub, 'claims are restored');
  result := public.crm_mcp_read(token, 'lex_get_lead', jsonb_build_object('id', foreign_lead));
  perform pg_temp.assert_mcp(result#>'{data,record}' = 'null'::jsonb, 'cross-firm lead is invisible');
  result := public.crm_mcp_read(token, 'lex_get_lead', jsonb_build_object('id', lead));
  perform pg_temp.assert_mcp(result#>>'{data,record,id}' = lead::text, 'authorized lead is visible');
  result := public.crm_mcp_read(token, 'lex_get_contact', jsonb_build_object('id', other_contact));
  perform pg_temp.assert_mcp(result#>'{data,record}' = 'null'::jsonb, 'cross-firm contact is invisible');
  result := public.crm_mcp_read(token, 'lex_search_cases');
  perform pg_temp.assert_mcp(jsonb_array_length(result#>'{data,items}') = 1 and result#>>'{data,items,0,id}' = own_case::text, 'case assignment enforced');
  result := public.crm_mcp_read(token, 'lex_get_case', jsonb_build_object('id', hidden_case));
  perform pg_temp.assert_mcp(result#>'{data,record}' = 'null'::jsonb, 'unassigned case is invisible');
  result := public.crm_mcp_read(token, 'lex_list_case_documents', jsonb_build_object('caseId', own_case));
  perform pg_temp.assert_mcp(jsonb_array_length(result#>'{data,items}') = 1, 'document confidentiality enforced');
  perform pg_temp.assert_mcp(not (result::text like '%storage_path%') and not (result::text like '%fixture-visible%'), 'storage paths not exposed');
  result := public.crm_mcp_read(token, 'lex_list_case_documents', jsonb_build_object('caseId', hidden_case));
  perform pg_temp.assert_mcp(jsonb_array_length(result#>'{data,items}') = 0, 'hidden case documents invisible');
  perform pg_temp.assert_mcp(public.crm_mcp_read(scoped_token, 'lex_search_cases')->>'error' = 'forbidden', 'scope enforced at RPC');
  perform pg_temp.assert_mcp(public.crm_mcp_read(token, 'lex_search_leads', '{"firmId":"other"}')->>'error' = 'invalid_arguments', 'tenant override rejected');
  perform pg_temp.assert_mcp(public.crm_mcp_read(token, 'lex_get_case', '{}')->>'error' = 'invalid_arguments', 'missing id rejected');
  perform pg_temp.assert_mcp(public.crm_mcp_read(token, 'lex_search_leads', '{"limit":51}')->>'error' = 'invalid_arguments', 'unbounded page rejected');
  perform pg_temp.assert_mcp(public.crm_mcp_read(token, 'lex_search_leads', '{"query":"%"}')#>'{data,items}' = '[]'::jsonb, 'wildcards are literal');
  perform pg_temp.assert_mcp(public.crm_mcp_read(token, 'delete from crm_contacts')->>'error' = 'forbidden', 'arbitrary SQL rejected');
  perform pg_temp.assert_mcp(public.crm_mcp_read('invalid', 'lex_whoami')->>'error' = 'unauthorized', 'invalid credential rejected');

  update public.crm_firm_members set status = 'disabled' where firm_id = firm and user_id = actor;
  perform pg_temp.assert_mcp(public.crm_mcp_read(token, 'lex_whoami')->>'error' = 'unauthorized', 'disabled member blocked immediately');
  update public.crm_firm_members set status = 'active' where firm_id = firm and user_id = actor;
  update auth.users set banned_until = now() + interval '1 day' where id = actor;
  perform pg_temp.assert_mcp(public.crm_mcp_read(token, 'lex_whoami')->>'error' = 'unauthorized', 'banned account blocked');
  update auth.users set banned_until = null where id = actor;
  update lex_mcp.credentials set created_at = now() - interval '2 days', expires_at = now() - interval '1 day' where id = (key_result->>'id')::uuid;
  perform pg_temp.assert_mcp(public.crm_mcp_read(token, 'lex_whoami')->>'error' = 'unauthorized', 'expired key blocked');
  update lex_mcp.credentials set expires_at = now() + interval '1 day', window_start = now(), window_count = 120 where id = (key_result->>'id')::uuid;
  perform pg_temp.assert_mcp(public.crm_mcp_read(token, 'lex_whoami')->>'error' = 'rate_limited', 'persistent rate limit enforced');
  update lex_mcp.credentials set window_count = 0 where id = (key_result->>'id')::uuid;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform public.crm_mcp_revoke_key((key_result->>'id')::uuid);
  perform pg_temp.assert_mcp(public.crm_mcp_read(token, 'lex_whoami')->>'error' = 'unauthorized', 'revocation immediate');
  perform pg_temp.assert_mcp(exists(select 1 from lex_mcp.audit where user_id = actor and operation = 'lex_get_lead' and outcome = 'ok'), 'read attributable to account');
end;
$$;
rollback;