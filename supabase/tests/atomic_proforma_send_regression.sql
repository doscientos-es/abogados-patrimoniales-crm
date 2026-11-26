-- Run on an explicitly authorized test database after migrations; fixtures roll back.
begin;

do $$
declare
  actor uuid := gen_random_uuid(); firm uuid := gen_random_uuid();
  contact uuid := gen_random_uuid(); lead uuid := gen_random_uuid();
  other_lead uuid := gen_random_uuid(); other_actor uuid := gen_random_uuid();
  onboarding public.crm_onboardings; saved public.crm_opportunities;
  proforma jsonb := jsonb_build_object('estado', 'enviada', 'fechaEnvio', current_date::text);
  rejected boolean := false;
begin
  insert into auth.users(id, email) values
    (actor, actor::text || '@test.invalid'), (other_actor, other_actor::text || '@test.invalid');
  insert into public.crm_firms(id, name) values (firm, 'Proforma transaction test');
  insert into public.crm_firm_members(firm_id, user_id, role, status) values (firm, actor, 'owner', 'active');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  insert into public.crm_contacts(id, firm_id, reference, nature, relationship, display_name)
    values (contact, firm, 'TEST-' || contact::text, 'person', 'lead', 'Test');
  insert into public.crm_opportunities(id, firm_id, contact_id, reference, title, stage, details)
    values (lead, firm, contact, 'TEST-' || lead::text, 'Test', 'won', '{}'::jsonb),
           (other_lead, firm, contact, 'TEST-' || other_lead::text, 'Other', 'won', '{}'::jsonb);
  select * into onboarding from public.crm_create_onboarding(firm, contact, lead, 'Test', 'PR-TEST', 100, actor, null, 'Test');

  begin
    perform public.crm_save_sent_proforma(lead, 999, onboarding.id, onboarding.version, proforma);
  exception when serialization_failure then rejected := true; end;
  if not rejected or (select proforma_sent_on from public.crm_onboardings where id = onboarding.id) is not null
    or (select details from public.crm_opportunities where id = lead) ? 'proforma' then
    raise exception 'A stale lead must roll back both changes';
  end if;

  rejected := false;
  begin
    perform public.crm_save_sent_proforma(other_lead, 1, onboarding.id, onboarding.version, proforma);
  exception when others then
    if sqlerrm <> 'Onboarding not found' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Onboarding must belong to the selected lead'; end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', other_actor, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', other_actor::text, true);
  rejected := false;
  begin
    perform public.crm_save_sent_proforma(lead, 1, onboarding.id, onboarding.version, proforma);
  exception when others then
    if sqlerrm <> 'Lead not found' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Non-members must not register a proforma'; end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor::text, true);

  select * into saved from public.crm_save_sent_proforma(lead, 1, onboarding.id, onboarding.version, proforma);
  if saved.details -> 'proforma' is distinct from proforma
    or (select proforma_sent_on from public.crm_onboardings where id = onboarding.id) is distinct from current_date then
    raise exception 'Lead and onboarding must both record the proforma';
  end if;
  if not exists (select 1 from public.crm_onboarding_events where onboarding_id = onboarding.id
    and event_type = 'proforma_sent_registered' and actor_id = actor) then
    raise exception 'The send event must identify its actor';
  end if;
end;
$$;
rollback;