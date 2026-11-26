-- Run after the receipt and invoice guard migrations in a transaction; all fixtures roll back.
begin;
do $$
declare
  actor uuid := gen_random_uuid(); outsider uuid := gen_random_uuid(); lawyer uuid := gen_random_uuid();
  firm uuid := gen_random_uuid(); contact uuid := gen_random_uuid(); target_case uuid := gen_random_uuid();
  lead uuid := gen_random_uuid(); second_lead uuid := gen_random_uuid();
  other_case uuid := gen_random_uuid(); onboarding public.crm_onboardings; second public.crm_onboardings;
  receipt public.crm_onboarding_receipts; second_receipt public.crm_onboarding_receipts;
  draft public.crm_invoices; invoice public.crm_invoices; other_invoice public.crm_invoices;
  payment public.crm_invoice_payments; rejected boolean;
begin
  insert into auth.users(id, email) values (actor, actor::text || '@test.invalid'),
    (outsider, outsider::text || '@test.invalid'), (lawyer, lawyer::text || '@test.invalid');
  insert into public.crm_firms(id, name) values (firm, 'Receipt regression');
  insert into public.crm_firm_members(firm_id, user_id, role, status) values
    (firm, actor, 'owner', 'active'), (firm, lawyer, 'lawyer', 'active');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  insert into public.crm_contacts(id, firm_id, reference, nature, relationship, display_name)
    values (contact, firm, 'TEST-' || contact::text, 'person', 'client', 'Test');
  insert into public.crm_opportunities(id, firm_id, contact_id, reference, title, stage, details) values
    (lead, firm, contact, 'TEST-' || lead::text, 'Test', 'won', '{}'::jsonb),
    (second_lead, firm, contact, 'TEST-' || second_lead::text, 'Second', 'won', '{}'::jsonb);
  insert into public.crm_cases(id, firm_id, primary_contact_id, case_number, title, nature) values
    (target_case, firm, contact, 1, 'Test', 'extrajudicial'),
    (other_case, firm, contact, 2, 'Other', 'extrajudicial');
  insert into public.crm_firm_settings(firm_id, legal_name, tax_id, address, professional_registration)
    values (firm, 'Test issuer', 'TEST', 'Address', 'Registration');
  select * into onboarding from public.crm_create_onboarding(firm, contact, lead, 'Test', 'PR-TEST', 100, actor, current_date, 'Test');
  rejected := false;
  begin
    perform public.crm_transition_onboarding(onboarding.id, onboarding.version, 'payment_confirmed', current_date, null, null);
  exception when others then
    if sqlerrm <> 'Record the provision receipt before confirming payment' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Legacy confirmation must be rejected'; end if;
  rejected := false;
  begin
    perform public.crm_confirm_onboarding_receipt(onboarding.id, onboarding.version, 0, current_date, 'transfer', '');
  exception when others then rejected := true; end;
  if not rejected or exists (select 1 from public.crm_onboarding_receipts where onboarding_id = onboarding.id) then
    raise exception 'Invalid payment must not be stored';
  end if;
  select * into onboarding from public.crm_confirm_onboarding_receipt(onboarding.id, onboarding.version, 100, current_date - 1, 'transfer', 'TEST');
  select * into receipt from public.crm_onboarding_receipts where onboarding_id = onboarding.id;
  if receipt.amount <> 100 or onboarding.payment_confirmed_on <> current_date - 1 or receipt.created_by <> actor then
    raise exception 'Receipt and transition must be recorded together with actor';
  end if;
  update public.crm_onboardings set case_id = target_case where id = onboarding.id;
  select * into draft from public.crm_save_invoice_draft(firm, null, 0, target_case, contact, 'Test', 'Test', 'EUR', current_date, null,
    '[{"description":"Service","quantity":1,"unit_price":100,"tax_rate":0}]'::jsonb);
  select * into invoice from public.crm_issue_invoice(draft.id, draft.version, current_date, null);
  select * into draft from public.crm_save_invoice_draft(firm, null, 0, other_case, contact, 'Test', 'Other', 'EUR', current_date, null,
    '[{"description":"Service","quantity":1,"unit_price":100,"tax_rate":0}]'::jsonb);
  select * into other_invoice from public.crm_issue_invoice(draft.id, draft.version, current_date, null);
  rejected := false;
  begin perform public.crm_apply_onboarding_receipt(receipt.id, other_invoice.id, null);
  exception when others then rejected := true; end;
  if not rejected then raise exception 'Other case must be rejected'; end if;
  perform set_config('request.jwt.claim.sub', lawyer::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', lawyer, 'role', 'authenticated')::text, true);
  rejected := false;
  begin perform public.crm_apply_onboarding_receipt(receipt.id, invoice.id, null);
  exception when others then rejected := true; end;
  if not rejected then raise exception 'Non-admin must not apply a receipt'; end if;
  perform set_config('request.jwt.claim.sub', outsider::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', outsider, 'role', 'authenticated')::text, true);
  rejected := false;
  begin perform public.crm_apply_onboarding_receipt(receipt.id, invoice.id, null);
  exception when others then rejected := true; end;
  if not rejected then raise exception 'Outsider must not apply a receipt'; end if;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
  perform public.crm_apply_onboarding_receipt(receipt.id, invoice.id, null);
  if (select count(*) from public.crm_invoice_payments where invoice_id = invoice.id) <> 1
    or (select paid_on from public.crm_invoices where id = invoice.id) <> current_date - 1 then
    raise exception 'Application must create exactly one payment and preserve its earlier date';
  end if;
  rejected := false;
  begin perform public.crm_apply_onboarding_receipt(receipt.id, invoice.id, null);
  exception when others then rejected := true; end;
  if not rejected then raise exception 'Receipt must not be applied twice'; end if;
  select * into second from public.crm_create_onboarding(firm, contact, second_lead, 'Second', 'PR-TEST2', 100, actor, current_date, 'Test');
  select * into second from public.crm_confirm_onboarding_receipt(second.id, second.version, 100, current_date, 'transfer', '');
  update public.crm_onboardings set case_id = other_case where id = second.id;
  select * into second_receipt from public.crm_onboarding_receipts where onboarding_id = second.id;
  select * into payment from public.crm_register_invoice_payment(other_invoice.id, 100, current_date, 'transfer', 'EXISTING');
  perform public.crm_apply_onboarding_receipt(second_receipt.id, other_invoice.id, payment.id);
  if (select count(*) from public.crm_invoice_payments where invoice_id = other_invoice.id) <> 1
    or (select invoice_payment_id from public.crm_onboarding_receipts where id = second_receipt.id) <> payment.id then
    raise exception 'Linking an existing payment must not duplicate it';
  end if;
end;
$$;
rollback;
