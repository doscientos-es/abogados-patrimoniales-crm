-- Run on an explicitly authorized test database after migrations; fixtures are rolled back.
begin;

do $$
declare
  firm uuid := gen_random_uuid();
  contact uuid := gen_random_uuid();
  lead uuid := gen_random_uuid();
  link uuid;
  token text := repeat('b', 64);
  prepared jsonb;
  result jsonb;
  wrong_code text;
  attempt integer;
begin
  insert into public.crm_firms(id, name) values (firm, 'Email verification test');
  insert into public.crm_contacts(id, firm_id, reference, nature, relationship, display_name)
    values (contact, firm, 'TEST-' || contact::text, 'person', 'lead', 'Test');
  insert into public.crm_opportunities(id, firm_id, contact_id, reference, title, stage, details)
    values (lead, firm, contact, 'TEST-' || lead::text, 'Test', 'engagement',
      '{"presupuesto":{"versionEnviada":1,"editor":{"actual":{"version":1,"envio":{"destinatario":"client@example.invalid"}},"anteriores":[]}}}'::jsonb);
  insert into public.crm_quote_acceptance_links(firm_id, opportunity_id, quote_version, token_hash, snapshot, expires_at)
    values (firm, lead, 1, encode(extensions.digest(token, 'sha256'), 'hex'), '{}'::jsonb, now() + interval '1 day')
    returning id into link;

  if public.crm_public_accept_quote_verified(token, 'Test', true, '', '000000') ->> 'status' is distinct from 'code_expired' then
    raise exception 'A code must be requested before acceptance';
  end if;
  prepared := public.crm_prepare_quote_verification(token);
  if prepared ->> 'status' is distinct from 'ready' or prepared ->> 'recipient' is distinct from 'client@example.invalid'
    or coalesce(prepared ->> 'code', '') !~ '^[0-9]{6}$' then
    raise exception 'Preparation must use the stored recipient and generate six digits';
  end if;
  if public.crm_prepare_quote_verification(token) ->> 'status' is distinct from 'rate_limited' then
    raise exception 'Immediate repeated sends must be limited';
  end if;
  wrong_code := case when prepared ->> 'code' = '000000' then '000001' else '000000' end;
  for attempt in 1..5 loop
    if public.crm_public_accept_quote_verified(token, 'Test', true, '', wrong_code) ->> 'status' is distinct from 'code_invalid' then
      raise exception 'Incorrect code must be rejected';
    end if;
  end loop;
  if public.crm_public_accept_quote_verified(token, 'Test', true, '', prepared ->> 'code') ->> 'status' is distinct from 'code_expired' then
    raise exception 'Too many attempts must invalidate the code';
  end if;
  if (select stage from public.crm_opportunities where id = lead) is distinct from 'engagement' then
    raise exception 'Incorrect verification must not accept the quote';
  end if;

  update public.crm_quote_acceptance_verification set last_sent_at = now() - interval '2 minutes' where link_id = link;
  prepared := public.crm_prepare_quote_verification(token);
  update public.crm_quote_acceptance_verification set code_expires_at = now() - interval '1 second' where link_id = link;
  if public.crm_public_accept_quote_verified(token, 'Test', true, '', prepared ->> 'code') ->> 'status' is distinct from 'code_expired' then
    raise exception 'Expired code must be rejected';
  end if;
  update public.crm_quote_acceptance_verification set last_sent_at = now() - interval '2 minutes' where link_id = link;
  prepared := public.crm_prepare_quote_verification(token);
  result := public.crm_public_accept_quote_verified(token, 'Test', true, 'test-agent', prepared ->> 'code');
  if result ->> 'status' is distinct from 'accepted' or result ->> 'already' is distinct from 'false' then
    raise exception 'The valid code must accept the quote exactly once';
  end if;
  if (select stage from public.crm_opportunities where id = lead) is distinct from 'won'
    or not exists (select 1 from public.crm_quote_acceptance_verification where link_id = link and code_hash is null and verified_at is not null)
    or not exists (select 1 from public.crm_opportunity_events where opportunity_id = lead and event_type = 'acceptance_email_verified') then
    raise exception 'Acceptance must record verification and clear the code';
  end if;
  if public.crm_public_accept_quote_verified(token, 'Test', true, '', prepared ->> 'code') ->> 'already' is distinct from 'true' then
    raise exception 'Repeated acceptance must be idempotent';
  end if;
end;
$$;

rollback;
