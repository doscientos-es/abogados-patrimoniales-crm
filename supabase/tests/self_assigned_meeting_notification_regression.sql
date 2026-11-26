-- LOCAL DISPOSABLE DATABASE ONLY, after migrations. All fixtures roll back.
begin;

do $$
declare
  actor uuid := gen_random_uuid();
  colleague uuid := gen_random_uuid();
  firm uuid := gen_random_uuid();
  contact uuid := gen_random_uuid();
  opportunity uuid := gen_random_uuid();
  self_meeting uuid := gen_random_uuid();
  self_with_message uuid := gen_random_uuid();
  regular_task uuid := gen_random_uuid();
  other_meeting uuid := gen_random_uuid();
  scheduled_meeting uuid := gen_random_uuid();
begin
  insert into auth.users(id, email) values
    (actor, actor::text || '@test.invalid'), (colleague, colleague::text || '@test.invalid');
  insert into public.crm_firms(id, name) values (firm, 'Meeting notification regression');
  insert into public.crm_firm_members(firm_id, user_id, role, status) values
    (firm, actor, 'owner', 'active'), (firm, colleague, 'lawyer', 'active');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
  insert into public.crm_contacts(id, firm_id, nature, relationship, display_name)
    values (contact, firm, 'person', 'lead', 'Test');
  insert into public.crm_opportunities(id, firm_id, contact_id, title)
    values (opportunity, firm, contact, 'Test');

  insert into public.crm_tasks(id, firm_id, opportunity_id, kind, title, assigned_to, meeting_details) values
    (self_meeting, firm, opportunity, 'event', 'Self meeting', actor, '{"specialType":"meeting","status":"preparation"}'),
    (self_with_message, firm, opportunity, 'event', 'Self meeting with message', actor, '{"specialType":"meeting","status":"preparation"}'),
    (regular_task, firm, opportunity, 'task', 'Self task', actor, '{}'),
    (other_meeting, firm, opportunity, 'event', 'Other meeting', colleague, '{"specialType":"meeting","status":"preparation"}'),
    (scheduled_meeting, firm, opportunity, 'event', 'Scheduled meeting', actor, '{"specialType":"meeting","status":"scheduled"}');
  insert into public.crm_task_messages(firm_id, task_id, author_id, body, message_type)
    values (firm, self_with_message, actor, 'Instrucciones', 'initial_assignment');

  set constraints all immediate;
  if (select count(*) from public.crm_notifications where task_id = self_meeting and recipient_id = actor and kind = 'task_assignment') <> 1
    or (select count(*) from public.crm_notifications where task_id = self_with_message and recipient_id = actor and kind = 'task_assignment') <> 1 then
    raise exception 'Self-assigned meeting requests must produce exactly one notification, with or without an initial message';
  end if;
  if exists (select 1 from public.crm_notifications where task_id in (regular_task, scheduled_meeting) and recipient_id = actor) then
    raise exception 'Ordinary self-assigned tasks and scheduled events must not be notified as requests';
  end if;
  if (select count(*) from public.crm_notifications where task_id = other_meeting and recipient_id = colleague and kind = 'task_assignment') <> 1 then
    raise exception 'Assignments to another member must retain exactly one notification';
  end if;
end;
$$;

rollback;