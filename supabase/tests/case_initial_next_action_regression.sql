-- Run on an explicitly authorized test database after migrations; fixtures roll back.
begin;

do $$
declare
  actor uuid := gen_random_uuid();
  firm uuid := gen_random_uuid();
  contact uuid := gen_random_uuid();
  with_action public.crm_cases;
  without_action public.crm_cases;
begin
  insert into auth.users(id, email) values (actor, actor::text || '@test.invalid');
  insert into public.crm_firms(id, name) values (firm, 'Case next action regression');
  insert into public.crm_firm_members(firm_id, user_id, role, status) values (firm, actor, 'owner', 'active');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  insert into public.crm_contacts(id, firm_id, reference, nature, relationship, display_name)
    values (contact, firm, 'TEST-' || contact::text, 'person', 'client', 'Test');

  select * into with_action from public.crm_create_case(firm, contact, null, 'Test', '', '', 'extrajudicial', 'medium', actor, current_date, 'Solicitar certificado', '');
  if (select count(*) from public.crm_tasks where case_id = with_action.id and title = 'Solicitar certificado' and is_next_action and status = 'pending') <> 1 then
    raise exception 'Case creation must create exactly one open next-action task';
  end if;
  select * into without_action from public.crm_create_case(firm, contact, null, 'No action', '', '', 'extrajudicial', 'medium', actor, current_date, '', '');
  if exists (select 1 from public.crm_tasks where case_id = without_action.id) then
    raise exception 'Empty next action must not create a task';
  end if;
end;
$$;

rollback;
