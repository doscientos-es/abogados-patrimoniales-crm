-- Expose only the issuer captured with the sent version, never client contact details.
create or replace function public.crm_public_quote_acceptance(access_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  acceptance_link public.crm_quote_acceptance_links;
  lead public.crm_opportunities;
  state text;
  issuer jsonb;
begin
  if access_token is null or access_token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('status', 'invalid'); end if;
  select * into acceptance_link from public.crm_quote_acceptance_links
    where token_hash = encode(extensions.digest(access_token, 'sha256'), 'hex');
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  select * into lead from public.crm_opportunities where id = acceptance_link.opportunity_id;
  state := case
    when acceptance_link.accepted_at is not null then 'accepted'
    when acceptance_link.revoked_at is not null then 'revoked'
    when acceptance_link.expires_at < now() then 'expired'
    when lead.id is null or lead.stage <> 'engagement'
      or (lead.details #>> '{presupuesto,versionEnviada}')::integer is distinct from acceptance_link.quote_version then 'superseded'
    else 'valid' end;
  if state not in ('valid', 'accepted') then return jsonb_build_object('status', state); end if;

  issuer := acceptance_link.snapshot #> '{instantanea,datosDespacho}';
  if jsonb_typeof(issuer -> 'legal_name') = 'string'
    and jsonb_typeof(issuer -> 'tax_id') = 'string'
    and jsonb_typeof(issuer -> 'address') = 'string'
    and jsonb_typeof(issuer -> 'professional_registration') = 'string' then
    issuer := jsonb_build_object(
      'legal_name', issuer ->> 'legal_name', 'tax_id', issuer ->> 'tax_id',
      'address', issuer ->> 'address', 'professional_registration', issuer ->> 'professional_registration'
    );
  else
    issuer := null;
  end if;
  return jsonb_build_object(
    'status', state, 'version', acceptance_link.quote_version, 'reference', acceptance_link.quote_reference,
    'snapshot', acceptance_link.snapshot - 'instantanea', 'issuer', issuer,
    'clientName', acceptance_link.client_name, 'firmName', acceptance_link.firm_name,
    'totalCents', acceptance_link.total_cents, 'expiresAt', acceptance_link.expires_at,
    'acceptedAt', acceptance_link.accepted_at, 'acceptorName', acceptance_link.acceptor_name
  );
end;
$$;
notify pgrst, 'reload schema';