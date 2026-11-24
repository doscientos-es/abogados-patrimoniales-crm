-- LOCAL DISPOSABLE DATABASE ONLY, after applying migrations. All fixtures roll back.
begin;

do $$
declare
  actor uuid := gen_random_uuid();
  firm uuid := gen_random_uuid();
  contact uuid := gen_random_uuid();
  lead uuid := gen_random_uuid();
  saved public.crm_opportunities;
  sent_quote jsonb := '{"estado":"Enviado al cliente","version":1,"versionEnviada":1,"validadoVersion":1,"destinatario":"cliente@example.invalid","canal":"Email","fechaEnvio":"2026-11-24"}'::jsonb;
  rejected boolean := false;
begin
  insert into auth.users(id, email) values (actor, actor::text || '@test.invalid');
  insert into public.crm_firms(id, name) values (firm, 'Quote regression');
  insert into public.crm_firm_members(firm_id, user_id, role, status) values (firm, actor, 'owner', 'active');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  insert into public.crm_contacts(id, firm_id, nature, relationship, display_name) values (contact, firm, 'person', 'lead', 'Test');
  insert into public.crm_opportunities(id, firm_id, contact_id, title, stage, details)
    values (lead, firm, contact, 'Test', 'won', jsonb_build_object('presupuesto', sent_quote));

  select * into saved from public.crm_save_opportunity_details(
    lead, 1, jsonb_build_object('presupuesto', sent_quote, 'proforma', jsonb_build_object('estado', 'borrador')),
    null, null, null
  );
  if saved.details #>> '{proforma,estado}' is distinct from 'borrador' then
    raise exception 'Saving a proforma must preserve the sent quote';
  end if;
  select * into saved from public.crm_save_opportunity_details(
    lead, saved.version, saved.details || jsonb_build_object('naturaleza', 'extrajudicial'), null, null, null
  );
  if saved.details ->> 'naturaleza' is distinct from 'extrajudicial' then
    raise exception 'Saving case nature must preserve the sent quote';
  end if;

  begin
    perform public.crm_save_opportunity_details(
      lead, saved.version,
      jsonb_set(saved.details, '{presupuesto,destinatario}', '"other@example.invalid"'::jsonb),
      null, null, null
    );
  exception when others then
    if sqlerrm <> 'The current approved quote, recipient, channel and actual send date are required' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Changing a sent quote must not bypass send validation'; end if;
end;
$$;

rollback;