-- Actuaciones e hitos históricos pasan a ser tareas marcadas al completarse.
alter table public.crm_tasks
  add column relevance text not null default 'normal' check (relevance in ('normal', 'activity', 'milestone')),
  add column client_visible boolean not null default false,
  add column client_informed boolean not null default false;

create index crm_tasks_relevant_idx on public.crm_tasks (firm_id, completed_at desc) where relevance <> 'normal';

drop function if exists public.crm_complete_task_as_activity(uuid, integer, text, text);
drop function if exists public.crm_complete_task(uuid, integer, text, text);

create function public.crm_complete_task(
  target_task_id uuid,
  target_expected_version integer,
  result_text text,
  continuity_decision text default null,
  task_relevance text default 'normal'
)
returns public.crm_tasks
language plpgsql
security definer
set search_path = public
as $$
declare current_task public.crm_tasks; saved_task public.crm_tasks; continuation public.crm_tasks;
begin
  select * into current_task from public.crm_tasks where id = target_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if not public.crm_task_actor_can_work(current_task) then raise exception 'Forbidden'; end if;
  if current_task.version <> target_expected_version then raise exception 'Task changed by another user; reload before saving' using errcode = '40001'; end if;
  if nullif(trim(result_text), '') is null then raise exception 'Completion result is required'; end if;
  if coalesce(task_relevance, 'normal') not in ('normal', 'activity', 'milestone') then raise exception 'Invalid task relevance'; end if;
  if current_task.is_next_action and (
    continuity_decision is null or continuity_decision not in ('create_next_task', 'close_without_continuity')
  ) then raise exception 'Next actions require a continuity decision'; end if;
  update public.crm_tasks set status = 'completed', completed_at = coalesce(completed_at, now()),
    completion_result = trim(result_text), relevance = coalesce(task_relevance, 'normal')
    where id = current_task.id returning * into saved_task;
  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values (saved_task.firm_id, saved_task.id, 'completed',
    jsonb_build_object('continuity', continuity_decision, 'relevance', saved_task.relevance));
  if current_task.is_next_action and continuity_decision = 'create_next_task' then
    insert into public.crm_tasks (
      firm_id, case_id, opportunity_id, workstream_id, kind, title, description,
      priority, assigned_to, parent_task_id, is_next_action, validation_status
    ) values (
      current_task.firm_id, current_task.case_id, current_task.opportunity_id,
      current_task.workstream_id, 'task', 'Continuación: ' || current_task.title, '',
      current_task.priority, current_task.assigned_to, current_task.id, true, 'not_required'
    ) returning * into continuation;
    insert into public.crm_task_events(firm_id, task_id, event_type, payload)
    values (continuation.firm_id, continuation.id, 'created',
      jsonb_build_object('status', continuation.status, 'parent_task_id', current_task.id));
    insert into public.crm_task_events(firm_id, task_id, event_type, payload)
    values (continuation.firm_id, continuation.id, 'continuation_created',
      jsonb_build_object('parent_task_id', current_task.id));
  end if;
  return saved_task;
end;
$$;

create function public.crm_set_task_client_visible(
  target_task_id uuid,
  target_expected_version integer,
  target_visible boolean
)
returns public.crm_tasks
language plpgsql
security definer
set search_path = public
as $$
declare current_task public.crm_tasks; saved_task public.crm_tasks;
begin
  select * into current_task from public.crm_tasks where id = target_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if current_task.version <> target_expected_version then raise exception 'Task changed by another user; reload before saving' using errcode = '40001'; end if;
  if current_task.relevance = 'normal' then raise exception 'Only activities and milestones can be shared with the client'; end if;
  update public.crm_tasks set client_visible = coalesce(target_visible, false)
    where id = current_task.id returning * into saved_task;
  return saved_task;
end;
$$;

create or replace function public.crm_register_client_report(target_case_id uuid, target_contact_id uuid, report_subject text, report_content text, report_channel text, report_occurred_at timestamp with time zone, reported_activities jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected record;
  changed_count integer;
  new_communication_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.crm_can_access_case(target_case_id) then raise exception 'Forbidden'; end if;
  if nullif(trim(report_content), '') is null or char_length(report_content) > 10000 then
    raise exception 'Report content is required and must be at most 10000 characters';
  end if;
  if char_length(coalesce(report_subject, '')) > 300 then raise exception 'Invalid report subject'; end if;
  if report_channel not in ('email', 'phone', 'whatsapp', 'in_person', 'video') then
    raise exception 'Invalid report channel';
  end if;
  if jsonb_typeof(reported_activities) <> 'array' then raise exception 'Reported activities must be an array'; end if;
  if exists (
    select 1 from jsonb_to_recordset(reported_activities) as item(id uuid, version integer)
    group by id having count(*) > 1
  ) then raise exception 'Duplicate activities are not allowed'; end if;

  for selected in
    select item.id, item.version
    from jsonb_to_recordset(reported_activities) as item(id uuid, version integer)
    order by item.id
  loop
    update public.crm_tasks
    set client_informed = true
    where id = selected.id and case_id = target_case_id and version = selected.version
      and relevance <> 'normal' and client_visible = true and client_informed = false;
    get diagnostics changed_count = row_count;
    if changed_count <> 1 then
      raise exception 'An activity changed or was already reported; reload before continuing' using errcode = '40001';
    end if;
  end loop;

  insert into public.crm_case_communications (
    firm_id, case_id, contact_id, direction, communication_type, channel, subject, content, occurred_at
  )
  select c.firm_id, c.id, target_contact_id, 'outbound', 'client_report', report_channel,
    coalesce(nullif(trim(report_subject), ''), 'Reporte de situación del expediente'),
    trim(report_content), coalesce(report_occurred_at, now())
  from public.crm_cases c
  where c.id = target_case_id
  returning id into new_communication_id;

  if new_communication_id is null then raise exception 'Could not register the client report'; end if;
  return new_communication_id;
end;
$$;

revoke all on function public.crm_complete_task(uuid, integer, text, text, text) from public, anon;
revoke all on function public.crm_set_task_client_visible(uuid, integer, boolean) from public, anon;
revoke all on function public.crm_register_client_report(uuid, uuid, text, text, text, timestamp with time zone, jsonb) from public, anon;
grant execute on function public.crm_complete_task(uuid, integer, text, text, text) to authenticated;
grant execute on function public.crm_set_task_client_visible(uuid, integer, boolean) to authenticated;
grant execute on function public.crm_register_client_report(uuid, uuid, text, text, text, timestamp with time zone, jsonb) to authenticated;

create or replace function public.crm_get_firm_member_assignment_count(target_firm_id uuid, target_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.crm_member_role;
  current_role public.crm_member_role;
  current_status public.crm_member_status;
  assignment_count integer;
begin
  select role into actor_role from public.crm_firm_members
  where firm_id = target_firm_id and user_id = auth.uid() and status = 'active';
  if auth.uid() is null or actor_role is null or actor_role not in ('owner', 'admin') then
    raise exception 'An owner or administrator is required';
  end if;

  select role, status into current_role, current_status from public.crm_firm_members
  where firm_id = target_firm_id and user_id = target_user_id;
  if not found then raise exception 'Member not found'; end if;
  if current_status <> 'disabled' then raise exception 'Only disabled members can be removed'; end if;
  if current_role = 'owner' then raise exception 'Owner access cannot be removed'; end if;
  if actor_role = 'admin' and current_role = 'admin' then
    raise exception 'Only the owner can administer administrator access';
  end if;

  select count(*)::integer into assignment_count from (
    select 1 from public.crm_opportunities where firm_id = target_firm_id and assigned_to = target_user_id
    union all select 1 from public.crm_tasks where firm_id = target_firm_id and assigned_to = target_user_id
    union all select 1 from public.crm_cases where firm_id = target_firm_id and assigned_to = target_user_id
    union all select 1 from public.crm_case_tasks where firm_id = target_firm_id and assigned_to = target_user_id
    union all select 1 from public.crm_case_workstreams where firm_id = target_firm_id and assigned_to = target_user_id
    union all select 1 from public.crm_case_dates where firm_id = target_firm_id and assigned_to = target_user_id
    union all select 1 from public.crm_case_communications where firm_id = target_firm_id and assigned_to = target_user_id
    union all select 1 from public.crm_case_documents where firm_id = target_firm_id and assigned_to = target_user_id
    union all select 1 from public.crm_onboardings where firm_id = target_firm_id and assigned_to = target_user_id
  ) assignments;
  return assignment_count;
end;
$$;

create or replace function public.crm_delete_firm_member(target_firm_id uuid, target_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.crm_member_role;
  current_role public.crm_member_role;
  current_status public.crm_member_status;
  released_assignments integer;
begin
  select role into actor_role from public.crm_firm_members
  where firm_id = target_firm_id and user_id = auth.uid() and status = 'active';
  if auth.uid() is null or actor_role is null or actor_role not in ('owner', 'admin') then
    raise exception 'An owner or administrator is required';
  end if;

  select role, status into current_role, current_status from public.crm_firm_members
  where firm_id = target_firm_id and user_id = target_user_id;
  if not found then raise exception 'Member not found'; end if;
  if current_status <> 'disabled' then raise exception 'Only disabled members can be removed'; end if;
  if current_role = 'owner' then raise exception 'Owner access cannot be removed'; end if;
  if actor_role = 'admin' and current_role = 'admin' then
    raise exception 'Only the owner can administer administrator access';
  end if;

  released_assignments := public.crm_get_firm_member_assignment_count(target_firm_id, target_user_id);
  update public.crm_opportunities set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_tasks set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_cases set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_case_tasks set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_case_workstreams set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_case_dates set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_case_communications set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_case_documents set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_onboardings set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  delete from public.crm_firm_members
  where firm_id = target_firm_id and user_id = target_user_id and status = 'disabled';
  if not found then raise exception 'Only disabled members can be removed'; end if;
  return released_assignments;
end;
$$;

alter table public.crm_case_documents drop constraint if exists crm_case_documents_firm_id_case_id_activity_id_fkey;
drop index if exists public.crm_case_documents_firm_id_case_id_activity_id_fk_idx;
alter table public.crm_case_documents drop column if exists activity_id;
drop table public.crm_case_activities;

notify pgrst, 'reload schema';

