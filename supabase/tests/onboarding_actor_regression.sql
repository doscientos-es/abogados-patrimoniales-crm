-- Run on an explicitly authorized test database after migrations; fixtures roll back.
begin;

do $$
declare
  actor uuid := gen_random_uuid();
  firm uuid := gen_random_uuid();
  contact uuid := gen_random_uuid();
  onboarding public.crm_onboardings;
begin
  insert into auth.users(id, email) values (actor, actor::text || '@test.invalid');
  insert into public.crm_firms(id, name) values (firm, 'Onboarding audit regression');
  insert into public.crm_firm_members(firm_id, user_id, role, status) values (firm, actor, 'owner', 'active');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  insert into public.crm_contacts(id, firm_id, reference, nature, relationship, display_name)
    values (contact, firm, 'TEST-' || contact::text, 'person', 'lead', 'Test');
  select * into onboarding from public.crm_create_onboarding(firm, contact, null, 'Test', 'PR-TEST', 100, actor, current_date, 'Test');
  select * into onboarding from public.crm_confirm_onboarding_receipt(onboarding.id, onboarding.version, 100, current_date, 'transfer', '');
  if not exists (select 1 from public.crm_onboarding_events where onboarding_id = onboarding.id and event_type = 'payment_confirmed' and actor_id = actor) then
    raise exception 'Payment event must identify its authenticated actor';
  end if;
  if exists (select 1 from public.crm_onboarding_events where onboarding_id = onboarding.id and actor_id is distinct from actor) then
    raise exception 'Creation and update events must identify their authenticated actor';
  end if;
end;
$$;

rollback;
