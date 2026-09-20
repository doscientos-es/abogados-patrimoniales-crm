-- Complete the LEX task acceptance flow without modifying prior migrations.

create or replace function public.crm_task_actor_can_work(current_task public.crm_tasks)
returns boolean language sql stable security definer set search_path = public as $$
  select current_task.assigned_to = auth.uid() or public.crm_task_actor_can_manage(current_task);
$$;

create or replace function public.crm_open_task(target_task_id uuid)
returns public.crm_tasks language plpgsql security definer set search_path = public as $$
declare current_task public.crm_tasks;
begin
  select * into current_task from public.crm_tasks where id = target_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if not public.crm_task_actor_can_work(current_task) then raise exception 'Only the responsible user or requester can open this task'; end if;
  if current_task.opened_at is null then
    update public.crm_tasks set opened_at = now(), opened_by = auth.uid()
    where id = current_task.id returning * into current_task;
    insert into public.crm_task_events(firm_id, task_id, event_type, payload)
    values (current_task.firm_id, current_task.id, 'opened', '{}'::jsonb);
  end if;
  return current_task;
end;
$$;

create or replace function public.crm_complete_task(
  target_task_id uuid, target_expected_version integer, result_text text,
  continuity_decision text default null
)
returns public.crm_tasks language plpgsql security definer set search_path = public as $$
declare current_task public.crm_tasks; saved_task public.crm_tasks; continuation public.crm_tasks;
begin
  select * into current_task from public.crm_tasks where id = target_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if not public.crm_task_actor_can_work(current_task) then raise exception 'Forbidden'; end if;
  if current_task.version <> target_expected_version then raise exception 'Task changed by another user; reload before saving' using errcode = '40001'; end if;
  if nullif(trim(result_text), '') is null then raise exception 'Completion result is required'; end if;
  if current_task.is_next_action and (
    continuity_decision is null or continuity_decision not in ('create_next_task', 'close_without_continuity')
  ) then raise exception 'Next actions require a continuity decision'; end if;
  update public.crm_tasks set status = 'completed', completed_at = coalesce(completed_at, now()),
    completion_result = trim(result_text) where id = current_task.id returning * into saved_task;
  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values (saved_task.firm_id, saved_task.id, 'completed', jsonb_build_object('continuity', continuity_decision));
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

create or replace function public.crm_update_task(
  target_task_id uuid, target_expected_version integer, new_title text, new_description text,
  new_status public.crm_task_status, new_priority public.crm_priority, new_due_at timestamptz,
  new_reminder_at timestamptz, new_assigned_to uuid
)
returns public.crm_tasks language plpgsql security definer set search_path = public as $$
declare current_task public.crm_tasks; saved_task public.crm_tasks;
begin
  select * into current_task from public.crm_tasks where id = target_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if not public.crm_task_actor_can_manage(current_task) then raise exception 'Only the requester or an administrator can edit this task'; end if;
  if current_task.version <> target_expected_version then raise exception 'Task changed by another user; reload before saving' using errcode = '40001'; end if;
  if new_status is distinct from current_task.status then raise exception 'Use a task transition RPC to change status'; end if;
  if nullif(trim(new_title), '') is null then raise exception 'Title is required'; end if;
  perform public.crm_assert_active_task_assignee(current_task.firm_id, new_assigned_to);
  update public.crm_tasks set title = trim(new_title), description = coalesce(new_description, ''),
    priority = new_priority, due_at = new_due_at, due_on = new_due_at at time zone 'Europe/Madrid',
    reminder_at = new_reminder_at, assigned_to = new_assigned_to,
    opened_at = case when new_assigned_to is distinct from current_task.assigned_to then null else opened_at end,
    opened_by = case when new_assigned_to is distinct from current_task.assigned_to then null else opened_by end
  where id = current_task.id returning * into saved_task;
  if saved_task.title is distinct from current_task.title then
    insert into public.crm_task_events(firm_id, task_id, event_type) values (saved_task.firm_id, saved_task.id, 'title_changed');
  end if;
  if saved_task.description is distinct from current_task.description then
    insert into public.crm_task_events(firm_id, task_id, event_type) values (saved_task.firm_id, saved_task.id, 'description_changed');
  end if;
  if saved_task.priority is distinct from current_task.priority then
    insert into public.crm_task_events(firm_id, task_id, event_type) values (saved_task.firm_id, saved_task.id, 'priority_changed');
  end if;
  if saved_task.due_at is distinct from current_task.due_at then
    insert into public.crm_task_events(firm_id, task_id, event_type) values (saved_task.firm_id, saved_task.id, 'due_date_changed');
  end if;
  if saved_task.reminder_at is distinct from current_task.reminder_at then
    insert into public.crm_task_events(firm_id, task_id, event_type) values (saved_task.firm_id, saved_task.id, 'reminder_changed');
  end if;
  if saved_task.assigned_to is distinct from current_task.assigned_to then
    insert into public.crm_task_events(firm_id, task_id, event_type) values (saved_task.firm_id, saved_task.id, 'reassigned');
  end if;
  return saved_task;
end;
$$;

create or replace function public.crm_update_task_meeting(
  target_task_id uuid, target_expected_version integer, new_meeting_details jsonb
)
returns public.crm_tasks language plpgsql security definer set search_path = public as $$
declare current_task public.crm_tasks; saved_task public.crm_tasks;
begin
  select * into current_task from public.crm_tasks where id = target_task_id for update;
  if not found or current_task.kind <> 'event' then raise exception 'Meeting task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if not public.crm_task_actor_can_manage(current_task) then raise exception 'Only the requester or an administrator can edit meeting details'; end if;
  if current_task.version <> target_expected_version then raise exception 'Task changed by another user; reload before saving' using errcode = '40001'; end if;
  if jsonb_typeof(new_meeting_details) <> 'object'
    or nullif(trim(coalesce(new_meeting_details ->> 'startsAt', '')), '') is null
    or nullif(trim(coalesce(new_meeting_details ->> 'endsAt', '')), '') is null
    or coalesce(new_meeting_details ->> 'mode', '') not in ('office_bilbao', 'office_recalde', 'phone', 'outside_office')
    or (new_meeting_details ->> 'endsAt')::timestamptz <= (new_meeting_details ->> 'startsAt')::timestamptz then
    raise exception 'Meeting details require start, end and a valid mode';
  end if;
  update public.crm_tasks set meeting_details = new_meeting_details
  where id = current_task.id returning * into saved_task;
  insert into public.crm_task_events(firm_id, task_id, event_type)
  values (saved_task.firm_id, saved_task.id, 'meeting_changed');
  return saved_task;
end;
$$;

create or replace function public.crm_add_task_message(target_task_id uuid, message_body text)
returns public.crm_task_messages language plpgsql security definer set search_path = public as $$
declare current_task public.crm_tasks; saved_message public.crm_task_messages;
begin
  select * into current_task from public.crm_tasks where id = target_task_id;
  if not found then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if not public.crm_task_actor_can_work(current_task) then raise exception 'Forbidden'; end if;
  if nullif(trim(message_body), '') is null then raise exception 'Message body is required'; end if;
  insert into public.crm_task_messages(firm_id, task_id, author_id, body)
  values (current_task.firm_id, current_task.id, auth.uid(), trim(message_body)) returning * into saved_message;
  return saved_message;
end;
$$;

create or replace function public.crm_add_task_evidence(target_task_id uuid, evidence_body text default null, target_document_id uuid default null)
returns public.crm_task_evidences language plpgsql security definer set search_path = public as $$
declare current_task public.crm_tasks; saved_evidence public.crm_task_evidences;
begin
  select * into current_task from public.crm_tasks where id = target_task_id;
  if not found then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if not public.crm_task_actor_can_work(current_task) then raise exception 'Forbidden'; end if;
  if nullif(trim(coalesce(evidence_body, '')), '') is null and target_document_id is null then raise exception 'Evidence body or document is required'; end if;
  if target_document_id is not null and not exists (
    select 1 from public.crm_case_documents document where document.id = target_document_id and document.firm_id = current_task.firm_id
  ) then raise exception 'Evidence document must belong to the same firm'; end if;
  insert into public.crm_task_evidences(firm_id, task_id, created_by, body, document_id)
  values (current_task.firm_id, current_task.id, auth.uid(), trim(coalesce(evidence_body, '')), target_document_id)
  returning * into saved_evidence;
  return saved_evidence;
end;
$$;

create index if not exists crm_task_messages_firm_id_idx on public.crm_task_messages(firm_id);
create index if not exists crm_task_messages_author_id_idx on public.crm_task_messages(author_id);
create index if not exists crm_task_evidences_firm_id_idx on public.crm_task_evidences(firm_id);
create index if not exists crm_task_evidences_created_by_idx on public.crm_task_evidences(created_by);
create index if not exists crm_task_evidences_document_id_idx on public.crm_task_evidences(document_id);
create index if not exists crm_task_dependencies_firm_id_idx on public.crm_task_dependencies(firm_id);
create index if not exists crm_task_dependencies_created_by_idx on public.crm_task_dependencies(created_by);
create index if not exists crm_task_inbox_items_firm_id_idx on public.crm_task_inbox_items(firm_id);
create index if not exists crm_task_inbox_items_task_id_idx on public.crm_task_inbox_items(task_id);
create index if not exists crm_tasks_opened_by_idx on public.crm_tasks(opened_by);
create index if not exists crm_tasks_parent_task_id_idx on public.crm_tasks(parent_task_id);

revoke all on function public.crm_task_actor_can_work(public.crm_tasks), public.crm_log_unblocked_task_successors() from public, anon, authenticated;
revoke all on function public.crm_update_task_meeting(uuid, integer, jsonb) from public, anon;
grant execute on function public.crm_update_task_meeting(uuid, integer, jsonb) to authenticated;
notify pgrst, 'reload schema';