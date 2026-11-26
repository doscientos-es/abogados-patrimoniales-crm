-- LOCAL DISPOSABLE DATABASE ONLY. Do not run against production. All fixtures roll back.
begin;

do $$
declare
  actor uuid := gen_random_uuid(); firm uuid := gen_random_uuid();
  contact uuid := gen_random_uuid(); case_id uuid := gen_random_uuid();
  draft public.crm_invoices; issued public.crm_invoices; credit public.crm_invoices;
  rejected boolean := false;
begin
  insert into auth.users(id, email) values (actor, actor::text || '@test.invalid');
  insert into public.crm_firms(id, name) values (firm, 'Invoice issuer test');
  insert into public.crm_firm_members(firm_id, user_id, role, status) values (firm, actor, 'owner', 'active');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  insert into public.crm_contacts(id, firm_id, nature, relationship, display_name) values (contact, firm, 'person', 'client', 'Test');
  insert into public.crm_cases(id, firm_id, primary_contact_id, case_number, title, nature)
    values (case_id, firm, contact, 1, 'Test', 'extrajudicial');

  select * into draft from public.crm_save_invoice_draft(
    firm, null, 0, case_id, contact, 'Test', 'Service', 'EUR', current_date, null,
    '[{"description":"Service","quantity":1,"unit_price":100,"tax_rate":21}]'::jsonb
  );
  begin
    perform public.crm_issue_invoice(draft.id, draft.version, current_date, null);
  exception when others then
    if sqlerrm not like 'Completa la razón social%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Issuance without issuer must fail'; end if;
  if (select invoice_sequence from public.crm_firms where id = firm) is distinct from 0 then
    raise exception 'Rejected issuance must not consume a number';
  end if;
  if (select status from public.crm_invoices where id = draft.id) is distinct from 'draft' then
    raise exception 'Rejected issuance must leave the invoice as draft';
  end if;

  insert into public.crm_firm_settings(firm_id, legal_name, tax_id, address, professional_registration)
    values (firm, 'Original issuer', 'TEST', 'Original address', 'Registration');
  select * into issued from public.crm_issue_invoice(draft.id, draft.version, current_date, null);
  if issued.details -> 'datos_emisor' is distinct from jsonb_build_object(
    'legal_name', 'Original issuer', 'tax_id', 'TEST',
    'address', 'Original address', 'professional_registration', 'Registration'
  ) then
    raise exception 'Issuance must capture the issuer';
  end if;
  update public.crm_firm_settings set legal_name = 'Changed issuer' where firm_id = firm;
  if (select details #>> '{datos_emisor,legal_name}' from public.crm_invoices where id = issued.id) is distinct from 'Original issuer' then
    raise exception 'Changing settings must not alter an issued snapshot';
  end if;

  rejected := false;
  begin
    update public.crm_invoices set details = '{}'::jsonb where id = issued.id;
  exception when others then
    if sqlerrm not like 'An issued invoice cannot be modified%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Issued snapshots must be immutable'; end if;

  update public.crm_firm_settings set tax_id = '' where firm_id = firm;
  rejected := false;
  begin
    perform public.crm_create_credit_note(issued.id, issued.version, 'Correction');
  exception when others then
    if sqlerrm not like 'Completa la razón social%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Credit note without issuer must fail'; end if;
  if (select invoice_sequence from public.crm_firms where id = firm) is distinct from 1 then
    raise exception 'Rejected credit note must not consume a number';
  end if;
  update public.crm_firm_settings set tax_id = 'TEST2' where firm_id = firm;
  select * into credit from public.crm_create_credit_note(issued.id, issued.version, 'Correction');
  if credit.details -> 'datos_emisor' is distinct from jsonb_build_object(
    'legal_name', 'Changed issuer', 'tax_id', 'TEST2',
    'address', 'Original address', 'professional_registration', 'Registration'
  ) then
    raise exception 'Credit note must capture issuer at its own issuance';
  end if;
end;
$$;

rollback;
