-- LOCAL DISPOSABLE DATABASE ONLY. All fixture writes roll back.
begin;
create function pg_temp.assert_draft(condition boolean, message text) returns void
language plpgsql as $$ begin
  if condition is distinct from true then raise exception 'Draft regression: %', message; end if;
end; $$;

do $$
declare
  actor uuid := gen_random_uuid(); other_actor uuid := gen_random_uuid();
  firm uuid := gen_random_uuid(); other_firm uuid := gen_random_uuid();
  contact uuid := gen_random_uuid(); other_contact uuid := gen_random_uuid();
  own_case uuid := gen_random_uuid(); hidden_case uuid := gen_random_uuid();
  lead uuid := gen_random_uuid(); foreign_lead uuid := gen_random_uuid();
  token text; read_token text; write_key_id uuid; payload jsonb; result jsonb; draft_id uuid;
begin
  insert into auth.users(id, email) values(actor, actor::text || '@mcp.invalid'), (other_actor, other_actor::text || '@mcp.invalid');
  insert into public.crm_firms(id, name) values(firm, 'Draft fixture'), (other_firm, 'Other fixture');
  insert into public.crm_firm_members(firm_id, user_id, role, status)
    values(firm, actor, 'lawyer', 'active'), (firm, other_actor, 'owner', 'active'), (other_firm, other_actor, 'owner', 'active');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', other_actor, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', other_actor::text, true);
  insert into public.crm_contacts(id, firm_id, nature, relationship, display_name)
    values(contact, firm, 'person', 'lead', 'Fixture'), (other_contact, other_firm, 'person', 'lead', 'Other');
  insert into public.crm_opportunities(id, firm_id, contact_id, title)
    values(lead, firm, contact, 'Fixture'), (foreign_lead, other_firm, other_contact, 'Other');
  insert into public.crm_cases(id, firm_id, primary_contact_id, case_number, title, nature, assigned_to)
    values(own_case, firm, contact, 901, 'Assigned', 'extrajudicial', actor),
      (hidden_case, firm, contact, 902, 'Hidden', 'extrajudicial', other_actor);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  result := public.crm_mcp_create_key(firm, 'Write', array['leads:read','cases:read','drafts:write'], now() + interval '1 day');
  token := result->>'token'; write_key_id := (result->>'id')::uuid;
  read_token := public.crm_mcp_create_key(firm, 'Read', array['leads:read'], now() + interval '1 day')->>'token';
  payload := jsonb_build_object('targetType', 'lead', 'targetId', lead, 'title', 'Draft', 'content', 'Fixture text', 'idempotencyKey', gen_random_uuid());
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.assert_draft(public.crm_mcp_save_internal_draft(token, payload)->>'error' = 'forbidden', 'switch defaults off');
  update lex_mcp.draft_settings set enabled = true where id;
  perform pg_temp.assert_draft(public.crm_mcp_save_internal_draft(read_token, payload)->>'error' = 'forbidden', 'read-only token denied');
  perform pg_temp.assert_draft(public.crm_mcp_save_internal_draft(token, payload || jsonb_build_object('targetId', foreign_lead))->>'error' = 'forbidden', 'cross-firm lead denied');
  perform pg_temp.assert_draft(public.crm_mcp_save_internal_draft(token, payload || jsonb_build_object('targetType', 'case', 'targetId', hidden_case))->>'error' = 'forbidden', 'unassigned case denied');
  perform pg_temp.assert_draft(public.crm_mcp_save_internal_draft(token, payload || '{"firmId":"other"}'::jsonb)->>'error' = 'invalid_arguments', 'caller cannot set identity');
  perform pg_temp.assert_draft(public.crm_mcp_save_internal_draft(token, payload || jsonb_build_object('content', repeat('x', 8001)))->>'error' = 'invalid_arguments', 'size bounded');
  result := public.crm_mcp_save_internal_draft(token, payload);
  draft_id := (result#>>'{data,id}')::uuid;
  perform pg_temp.assert_draft(result#>>'{data,status}' = 'pending_review', 'lead draft saved for review');
  result := public.crm_mcp_save_internal_draft(token, payload);
  perform pg_temp.assert_draft((result#>>'{data,id}')::uuid = draft_id and (result#>>'{data,idempotentReplay}')::boolean, 'retry returns same draft');
  perform pg_temp.assert_draft(public.crm_mcp_save_internal_draft(token, payload || '{"content":"Changed"}'::jsonb)->>'error' = 'invalid_arguments', 'retry cannot overwrite');
  payload := payload || jsonb_build_object('targetType', 'case', 'targetId', own_case, 'idempotencyKey', gen_random_uuid());
  perform pg_temp.assert_draft(public.crm_mcp_save_internal_draft(token, payload)#>>'{data,status}' = 'pending_review', 'assigned case accepted');
  perform pg_temp.assert_draft(current_setting('request.jwt.claim.sub') = '', 'identity restored');
  perform pg_temp.assert_draft(not has_table_privilege('anon', 'public.crm_internal_document_drafts', 'select'), 'anon cannot read drafts');
  perform pg_temp.assert_draft(not has_table_privilege('authenticated', 'public.crm_internal_document_drafts', 'insert'), 'direct writes denied');
  update lex_mcp.credentials set revoked_at = now() where id = write_key_id;
  perform pg_temp.assert_draft(public.crm_mcp_save_internal_draft(token, payload)->>'error' = 'unauthorized', 'revoked key denied');
  perform pg_temp.assert_draft(exists(select 1 from lex_mcp.audit where key_id = write_key_id and operation = 'lex_save_internal_draft' and outcome = 'ok'), 'creation audited');
end;
$$;
rollback;
