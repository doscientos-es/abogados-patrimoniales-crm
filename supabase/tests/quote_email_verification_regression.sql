-- LOCAL DISPOSABLE DATABASE ONLY, after all migrations. The fixtures roll back.
begin;
do $$
declare
  actor uuid := gen_random_uuid(); firm uuid := gen_random_uuid();
  contact uuid := gen_random_uuid(); lead uuid := gen_random_uuid();
  link uuid; token text; old_token text; prepared jsonb; result jsonb; code text;
  quote jsonb := '{"versionEnviada":1,"editor":{"actual":{"version":1,"referencia":"P-1","envio":{"destinatario":"cliente@example.invalid","copia":{"lineas":[],"instantanea":{"totales":{"total":12100}}}}},"anteriores":[]}}'::jsonb;
begin
  insert into auth.users(id, email) values (actor, actor::text || '@test.invalid');
  insert into public.crm_firms(id, name) values (firm, 'Verification test');
  insert into public.crm_firm_members(firm_id, user_id, role, status) values (firm, actor, 'owner', 'active');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  insert into public.crm_contacts(id, firm_id, nature, relationship, display_name) values (contact, firm, 'person', 'lead', 'Test');
  insert into public.crm_opportunities(id, firm_id, contact_id, title, stage, details)
    values (lead, firm, contact, 'Test', 'engagement', jsonb_build_object('presupuesto', quote));

  select link_id, t.token into link, token from public.crm_create_quote_acceptance_link(lead, 30) t;
  if (select recipient from public.crm_quote_acceptance_verification where link_id = link) is distinct from 'cliente@example.invalid' then
    raise exception 'The recipient must be frozen from the registered send';
  end if;
  delete from public.crm_quote_acceptance_verification where link_id = link; -- simulate a pre-migration link
  if public.crm_prepare_quote_verification(token) ->> 'status' is distinct from 'email_unavailable'
    or public.crm_public_accept_quote_verified(token, 'Client', true, '', '000000') ->> 'status' is distinct from 'email_unavailable' then
    raise exception 'Old links must not accept without a frozen recipient';
  end if;
  old_token := token;
  select link_id, t.token into link, token from public.crm_create_quote_acceptance_link(lead, 30) t;
  if public.crm_prepare_quote_verification(old_token) ->> 'status' is distinct from 'revoked' then
    raise exception 'Regeneration must revoke the previous link';
  end if;
  if public.crm_public_accept_quote_verified(token, 'Client', true, '', '000000') ->> 'status' is distinct from 'code_expired' then
    raise exception 'Acceptance must require a code';
  end if;
  prepared := public.crm_prepare_quote_verification(token);
  if prepared ->> 'status' is distinct from 'ready' then raise exception 'Code must be prepared'; end if;
  code := prepared ->> 'code';
  if public.crm_prepare_quote_verification(token) ->> 'status' is distinct from 'rate_limited' then
    raise exception 'Repeated sends must be limited';
  end if;
  for i in 1..5 loop
    result := public.crm_public_accept_quote_verified(token, 'Client', true, '', case when code = '000000' then '000001' else '000000' end);
    if result ->> 'status' is distinct from 'code_invalid' then raise exception 'Incorrect codes must fail'; end if;
  end loop;
  if public.crm_public_accept_quote_verified(token, 'Client', true, '', code) ->> 'status' is distinct from 'code_expired' then
    raise exception 'Too many attempts must invalidate the code';
  end if;
  update public.crm_quote_acceptance_verification set last_sent_at = clock_timestamp() - interval '2 minutes' where link_id = link;
  prepared := public.crm_prepare_quote_verification(token);
  code := prepared ->> 'code';
  update public.crm_quote_acceptance_verification set code_expires_at = clock_timestamp() - interval '1 second' where link_id = link;
  if public.crm_public_accept_quote_verified(token, 'Client', true, '', code) ->> 'status' is distinct from 'code_expired' then
    raise exception 'Expired codes must fail';
  end if;
  update public.crm_quote_acceptance_verification set last_sent_at = clock_timestamp() - interval '2 minutes' where link_id = link;
  prepared := public.crm_prepare_quote_verification(token);
  code := prepared ->> 'code';
  result := public.crm_public_accept_quote_verified(token, 'Client', true, 'test', code);
  if result ->> 'status' is distinct from 'accepted' then raise exception 'Correct code must accept'; end if;
  if not exists (select 1 from public.crm_opportunity_events where opportunity_id = lead and event_type = 'acceptance_email_verified'
    and payload ->> 'email' = 'cliente@example.invalid' and payload ->> 'link_id' = link::text) then
    raise exception 'The verified address must be recorded as evidence';
  end if;
  if (select code_hash from public.crm_quote_acceptance_verification where link_id = link) is not null then
    raise exception 'The code must be consumed';
  end if;
end;
$$;
rollback;