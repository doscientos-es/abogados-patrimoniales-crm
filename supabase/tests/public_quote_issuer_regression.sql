-- Run on an explicitly authorized test database after migrations; fixtures are rolled back.
begin;

do $$
declare
  firm uuid := gen_random_uuid();
  contact uuid := gen_random_uuid();
  lead uuid := gen_random_uuid();
  token text := repeat('a', 64);
  result jsonb;
  issuer jsonb := '{"legal_name":"Test issuer","tax_id":"TEST","address":"Test street","professional_registration":"Test registration","internal":"do not expose"}'::jsonb;
begin
  insert into public.crm_firms(id, name) values (firm, 'Public quote test');
  insert into public.crm_contacts(id, firm_id, reference, nature, relationship, display_name)
    values (contact, firm, 'TEST-' || contact::text, 'person', 'lead', 'Test');
  insert into public.crm_opportunities(id, firm_id, contact_id, reference, title, stage, details)
    values (lead, firm, contact, 'TEST-' || lead::text, 'Test', 'engagement',
      '{"presupuesto":{"versionEnviada":1,"editor":{"actual":{"version":1,"envio":{"destinatario":"client@example.invalid"}},"anteriores":[]}}}'::jsonb);
  insert into public.crm_quote_acceptance_links(firm_id, opportunity_id, quote_version, token_hash, snapshot, expires_at)
    values (firm, lead, 1, encode(extensions.digest(token, 'sha256'), 'hex'),
      jsonb_build_object('instantanea', jsonb_build_object(
        'datosDespacho', issuer, 'cliente', jsonb_build_object('email', 'client@example.invalid'), 'finalizadoPor', 'private-user')),
      now() + interval '1 day');

  result := public.crm_public_quote_acceptance(token);
  if result ->> 'status' is distinct from 'valid' or result -> 'issuer' is distinct from issuer - 'internal' then
    raise exception 'Public issuer must contain only captured issuer fields';
  end if;
  if result -> 'snapshot' ? 'instantanea' or result::text like '%client@example.invalid%'
    or result::text like '%private-user%' or result::text like '%do not expose%' then
    raise exception 'Public response exposed private snapshot fields';
  end if;
  update public.crm_quote_acceptance_links set snapshot = '{}'::jsonb
    where token_hash = encode(extensions.digest(token, 'sha256'), 'hex');
  if public.crm_public_quote_acceptance(token) -> 'issuer' is distinct from 'null'::jsonb then
    raise exception 'Historical snapshots without issuer must remain unchanged';
  end if;
end;
$$;

rollback;
