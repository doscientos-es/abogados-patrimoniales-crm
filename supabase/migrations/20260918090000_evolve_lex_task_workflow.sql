-- crm_tasks remains the sole shared task source. crm_case_tasks is deliberately
-- untouched so existing records remain available during the staged migration.

alter table public.crm_tasks
  add column if not exists is_next_action boolean not null default false,
  add column if not exists waiting_reason text,
  add column if not exists waiting_until timestamptz,
  add column if not exists waiting_detail text not null default '',
  add column if not exists completion_result text not null default '',
  add column if not exists cancellation_reason text not null default '',
  add column if not exists opened_at timestamptz,
  add column if not exists opened_by uuid references public.crm_profiles(id) on delete set null,
  add column if not exists rejection_reason text not null default '',
  add column if not exists rejected_at timestamptz,
  add column if not exists parent_task_id uuid references public.crm_tasks(id) on delete set null,
  add column if not exists meeting_details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(meeting_details) = 'object');

-- Preserve legacy terminal tasks while making the new outcome fields mandatory
-- for all future workflow transitions.
update public.crm_tasks
set completion_result = 'Completada antes de la migración del flujo LEX.'
where status = 'completed' and nullif(trim(completion_result), '') is null;

update public.crm_tasks
set cancellation_reason = 'Cancelada antes de la migración del flujo LEX.'
where status = 'cancelled' and nullif(trim(cancellation_reason), '') is null;

alter table public.crm_tasks
  add constraint crm_tasks_waiting_details_check check (
    status <> 'waiting' or (
      nullif(trim(waiting_reason), '') is not null and waiting_until is not null
    )
  ),
  add constraint crm_tasks_completion_result_check check (
    status <> 'completed' or nullif(trim(completion_result), '') is not null
  ),
  add constraint crm_tasks_cancellation_reason_check check (
    status <> 'cancelled' or nullif(trim(cancellation_reason), '') is not null
  );

create table public.crm_task_messages (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  task_id uuid not null references public.crm_tasks(id) on delete cascade,
  author_id uuid references public.crm_profiles(id) on delete set null,
  body text not null check (char_length(trim(body)) > 0),
  message_type text not null default 'comment'
    check (message_type in ('initial_assignment', 'comment', 'system')),
  created_at timestamptz not null default now()
);

create table public.crm_task_evidences (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  task_id uuid not null references public.crm_tasks(id) on delete cascade,
  created_by uuid references public.crm_profiles(id) on delete set null,
  body text not null default '',
  document_id uuid references public.crm_case_documents(id) on delete set null,
  created_at timestamptz not null default now(),
  check (nullif(trim(body), '') is not null or document_id is not null)
);

create table public.crm_task_dependencies (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  predecessor_task_id uuid not null references public.crm_tasks(id) on delete cascade,
  successor_task_id uuid not null references public.crm_tasks(id) on delete cascade,
  created_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (predecessor_task_id, successor_task_id),
  check (predecessor_task_id <> successor_task_id)
);

create table public.crm_task_inbox_items (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  user_id uuid not null references public.crm_profiles(id) on delete cascade,
  task_id uuid references public.crm_tasks(id) on delete cascade,
  capture_text text not null default '',
  stage text not null default 'inbox' check (stage in (
    'inbox', 'clarify', 'delegate', 'next', 'now', 'waiting', 'weekly_review'
  )),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (task_id is not null or nullif(trim(capture_text), '') is not null)
);

create index crm_task_messages_task_created_idx
  on public.crm_task_messages(task_id, created_at);
create index crm_task_evidences_task_created_idx
  on public.crm_task_evidences(task_id, created_at);
create index crm_task_dependencies_successor_idx
  on public.crm_task_dependencies(successor_task_id);
create index crm_task_dependencies_predecessor_idx
  on public.crm_task_dependencies(predecessor_task_id);
create index crm_task_inbox_items_user_stage_position_idx
  on public.crm_task_inbox_items(user_id, stage, position, created_at);
create index crm_tasks_waiting_review_idx on public.crm_tasks(firm_id, waiting_until)
  where status = 'waiting';
create unique index crm_tasks_one_open_next_action_per_case_idx
  on public.crm_tasks(firm_id, case_id)
  where is_next_action and case_id is not null and status in ('pending', 'in_progress', 'waiting');
create unique index crm_tasks_one_open_next_action_per_opportunity_idx
  on public.crm_tasks(firm_id, opportunity_id)
  where is_next_action and opportunity_id is not null and status in ('pending', 'in_progress', 'waiting');

create or replace function public.crm_validate_task_inbox_item()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.task_id is not null and not exists (
    select 1 from public.crm_tasks task
    where task.id = new.task_id and task.firm_id = new.firm_id
  ) then
    raise exception 'Inbox task must belong to the same firm';
  end if;
  if not exists (
    select 1 from public.crm_firm_members member
    where member.firm_id = new.firm_id and member.user_id = new.user_id and member.status = 'active'
  ) then
    raise exception 'Inbox user must be an active firm member';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger crm_task_inbox_items_validate before insert or update on public.crm_task_inbox_items
  for each row execute function public.crm_validate_task_inbox_item();

create or replace function public.crm_normalize_task_workflow()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status <> 'waiting' then
    new.waiting_reason := null;
    new.waiting_until := null;
    new.waiting_detail := '';
  end if;
  if new.status <> 'completed' then new.completion_result := ''; end if;
  if new.status <> 'cancelled' then new.cancellation_reason := ''; end if;
  if new.status in ('completed', 'cancelled') then new.is_next_action := false; end if;
  return new;
end;
$$;

drop trigger if exists crm_tasks_workflow_normalize on public.crm_tasks;
create trigger crm_tasks_workflow_normalize before insert or update on public.crm_tasks
  for each row execute function public.crm_normalize_task_workflow();

create or replace function public.crm_task_actor_can_manage(current_task public.crm_tasks)
returns boolean language sql stable security definer set search_path = public as $$
  select current_task.created_by = auth.uid() or exists (
    select 1 from public.crm_firm_members member
    where member.firm_id = current_task.firm_id and member.user_id = auth.uid()
      and member.status = 'active' and member.role in ('owner', 'admin', 'lawyer')
  );
$$;

create or replace function public.crm_assert_task_member(current_task public.crm_tasks)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.crm_is_firm_member(current_task.firm_id) then raise exception 'Forbidden'; end if;
end;
$$;

-- Keep task events append-only, but make business RPCs responsible for the
-- meaningful event name instead of logging a second generic status update.
drop trigger if exists crm_tasks_log_update on public.crm_tasks;

create or replace function public.crm_create_task(
  target_firm_id uuid, target_case_id uuid, target_opportunity_id uuid,
  new_kind text, new_title text, new_description text, new_priority public.crm_priority,
  new_due_at timestamptz, new_reminder_at timestamptz, new_assigned_to uuid,
  new_deadline_class text default null, initial_message text default null, new_parent_task_id uuid default null,
  new_meeting_details jsonb default '{}'::jsonb
)
returns public.crm_tasks language plpgsql security definer set search_path = public as $$
declare created_task public.crm_tasks;
begin
  if auth.uid() is null or not public.crm_is_firm_member(target_firm_id) then raise exception 'Forbidden'; end if;
  if nullif(trim(new_title), '') is null then raise exception 'Title is required'; end if;
  if target_case_id is null and target_opportunity_id is null then raise exception 'Task context is required'; end if;
  if new_kind not in ('task', 'reminder', 'event', 'deadline') then raise exception 'Invalid task kind'; end if;
  if new_kind = 'deadline' and (new_due_at is null or new_deadline_class not in ('judicial', 'extrajudicial')) then
    raise exception 'Deadlines require a due date and class';
  end if;
  if jsonb_typeof(coalesce(new_meeting_details, '{}'::jsonb)) <> 'object' then raise exception 'Meeting details must be an object'; end if;
  insert into public.crm_tasks (
    firm_id, case_id, opportunity_id, kind, title, description, priority, due_at, due_on,
    reminder_at, assigned_to, deadline_class, validation_status, parent_task_id, meeting_details
  ) values (
    target_firm_id, target_case_id, target_opportunity_id, new_kind, trim(new_title),
    coalesce(new_description, ''), coalesce(new_priority, 'medium'), new_due_at,
    new_due_at at time zone 'Europe/Madrid', new_reminder_at, new_assigned_to, new_deadline_class,
    case when new_kind = 'deadline' then 'proposed' else 'not_required' end,
    new_parent_task_id, coalesce(new_meeting_details, '{}'::jsonb)
  ) returning * into created_task;
  if nullif(trim(initial_message), '') is not null then
    insert into public.crm_task_messages(firm_id, task_id, author_id, body, message_type)
    values (created_task.firm_id, created_task.id, auth.uid(), trim(initial_message), 'initial_assignment');
  end if;
  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values (created_task.firm_id, created_task.id, 'created', jsonb_build_object('status', created_task.status));
  return created_task;
end;
$$;

create or replace function public.crm_open_task(target_task_id uuid)
returns public.crm_tasks language plpgsql security definer set search_path = public as $$
declare current_task public.crm_tasks;
begin
  select * into current_task from public.crm_tasks where id = target_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if current_task.opened_at is null then
    update public.crm_tasks set opened_at = now(), opened_by = auth.uid()
    where id = current_task.id returning * into current_task;
    insert into public.crm_task_events(firm_id, task_id, event_type, payload)
    values (current_task.firm_id, current_task.id, 'opened', '{}'::jsonb);
  end if;
  return current_task;
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
  update public.crm_tasks set title = trim(new_title), description = coalesce(new_description, ''),
    priority = new_priority, due_at = new_due_at, due_on = new_due_at at time zone 'Europe/Madrid',
    reminder_at = new_reminder_at, assigned_to = new_assigned_to
  where id = current_task.id returning * into saved_task;
  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values (saved_task.firm_id, saved_task.id, 'edited', jsonb_build_object('version', saved_task.version));
  return saved_task;
end;
$$;

create or replace function public.crm_set_task_status(
  target_task_id uuid, target_expected_version integer, new_status public.crm_task_status,
  result_text text default null, cancellation_text text default null
)
returns public.crm_tasks language plpgsql security definer set search_path = public as $$
declare current_task public.crm_tasks; saved_task public.crm_tasks; old_status public.crm_task_status;
begin
  select * into current_task from public.crm_tasks where id = target_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if current_task.assigned_to is distinct from auth.uid() and not public.crm_task_actor_can_manage(current_task) then raise exception 'Only the responsible user or requester can change this status'; end if;
  if current_task.version <> target_expected_version then raise exception 'Task changed by another user; reload before saving' using errcode = '40001'; end if;
  if new_status = 'waiting' then raise exception 'Use crm_put_task_on_hold'; end if;
  if new_status = 'completed' then raise exception 'Use crm_complete_task'; end if;
  if new_status = 'cancelled' and nullif(trim(cancellation_text), '') is null then raise exception 'Cancellation reason is required'; end if;
  old_status := current_task.status;
  update public.crm_tasks set status = new_status,
    cancellation_reason = case when new_status = 'cancelled' then trim(cancellation_text) else '' end
  where id = current_task.id returning * into saved_task;
  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values (saved_task.firm_id, saved_task.id, 'status_changed', jsonb_build_object('from', old_status, 'to', new_status));
  return saved_task;
end;
$$;

create or replace function public.crm_put_task_on_hold(
  target_task_id uuid, target_expected_version integer, reason text, review_at timestamptz,
  detail text default null
)
returns public.crm_tasks language plpgsql security definer set search_path = public as $$
declare current_task public.crm_tasks; saved_task public.crm_tasks;
begin
  select * into current_task from public.crm_tasks where id = target_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if current_task.assigned_to is distinct from auth.uid() and not public.crm_task_actor_can_manage(current_task) then raise exception 'Forbidden'; end if;
  if current_task.version <> target_expected_version then raise exception 'Task changed by another user; reload before saving' using errcode = '40001'; end if;
  if nullif(trim(reason), '') is null or review_at is null then raise exception 'Waiting tasks require a reason and review date'; end if;
  update public.crm_tasks set status = 'waiting', waiting_reason = trim(reason), waiting_until = review_at,
    waiting_detail = trim(coalesce(detail, '')) where id = current_task.id returning * into saved_task;
  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values (saved_task.firm_id, saved_task.id, 'waiting_started', jsonb_build_object('review_at', review_at));
  return saved_task;
end;
$$;

create or replace function public.crm_reactivate_waiting_tasks()
returns integer language plpgsql security definer set search_path = public as $$
declare task_record public.crm_tasks; reactivated_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  for task_record in
    select * from public.crm_tasks
    where status = 'waiting'
      and (waiting_until at time zone 'Europe/Madrid')::date <= (now() at time zone 'Europe/Madrid')::date
      and public.crm_is_firm_member(firm_id)
    for update
  loop
    update public.crm_tasks set status = 'pending' where id = task_record.id;
    insert into public.crm_task_events(firm_id, task_id, event_type, payload)
    values (task_record.firm_id, task_record.id, 'waiting_review_due', '{}'::jsonb);
    reactivated_count := reactivated_count + 1;
  end loop;
  return reactivated_count;
end;
$$;

create or replace function public.crm_complete_task(
  target_task_id uuid, target_expected_version integer, result_text text,
  continuity_decision text default null
)
returns public.crm_tasks language plpgsql security definer set search_path = public as $$
declare current_task public.crm_tasks; saved_task public.crm_tasks;
begin
  select * into current_task from public.crm_tasks where id = target_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if current_task.assigned_to is distinct from auth.uid() and not public.crm_task_actor_can_manage(current_task) then raise exception 'Forbidden'; end if;
  if current_task.version <> target_expected_version then raise exception 'Task changed by another user; reload before saving' using errcode = '40001'; end if;
  if nullif(trim(result_text), '') is null then raise exception 'Completion result is required'; end if;
  if current_task.is_next_action and continuity_decision not in ('create_next_task', 'close_without_continuity') then raise exception 'Next actions require a continuity decision'; end if;
  update public.crm_tasks set status = 'completed', completed_at = coalesce(completed_at, now()),
    completion_result = trim(result_text) where id = current_task.id returning * into saved_task;
  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values (saved_task.firm_id, saved_task.id, 'completed', jsonb_build_object('continuity', continuity_decision));
  return saved_task;
end;
$$;

create or replace function public.crm_complete_and_unlock(
  target_task_id uuid, target_expected_version integer, result_text text,
  continuity_decision text default null
)
returns public.crm_tasks language sql security definer set search_path = public as $$
  select public.crm_complete_task(target_task_id, target_expected_version, result_text, continuity_decision);
$$;

create or replace function public.crm_set_next_action(
  target_task_id uuid, target_expected_version integer, enabled boolean
)
returns public.crm_tasks language plpgsql security definer set search_path = public as $$
declare current_task public.crm_tasks; saved_task public.crm_tasks;
begin
  select * into current_task from public.crm_tasks where id = target_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if not public.crm_task_actor_can_manage(current_task) then raise exception 'Only the requester or an administrator can choose the next action'; end if;
  if current_task.version <> target_expected_version then raise exception 'Task changed by another user; reload before saving' using errcode = '40001'; end if;
  if enabled and current_task.status in ('completed', 'cancelled') then raise exception 'Only open tasks can be the next action'; end if;
  if enabled then
    update public.crm_tasks set is_next_action = false
    where firm_id = current_task.firm_id and id <> current_task.id and is_next_action
      and status in ('pending', 'in_progress', 'waiting')
      and (case_id is not distinct from current_task.case_id or opportunity_id is not distinct from current_task.opportunity_id);
  end if;
  update public.crm_tasks set is_next_action = enabled where id = current_task.id returning * into saved_task;
  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values (saved_task.firm_id, saved_task.id, 'next_action_changed', jsonb_build_object('enabled', enabled));
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
  if nullif(trim(coalesce(evidence_body, '')), '') is null and target_document_id is null then raise exception 'Evidence body or document is required'; end if;
  if target_document_id is not null and not exists (
    select 1 from public.crm_case_documents document
    where document.id = target_document_id and document.firm_id = current_task.firm_id
  ) then raise exception 'Evidence document must belong to the same firm'; end if;
  insert into public.crm_task_evidences(firm_id, task_id, created_by, body, document_id)
  values (current_task.firm_id, current_task.id, auth.uid(), trim(coalesce(evidence_body, '')), target_document_id)
  returning * into saved_evidence;
  return saved_evidence;
end;
$$;

create or replace function public.crm_create_task_dependency(target_predecessor_id uuid, target_successor_id uuid)
returns public.crm_task_dependencies language plpgsql security definer set search_path = public as $$
declare predecessor public.crm_tasks; successor public.crm_tasks; created_dependency public.crm_task_dependencies;
begin
  select * into predecessor from public.crm_tasks where id = target_predecessor_id for update;
  select * into successor from public.crm_tasks where id = target_successor_id for update;
  if not found or predecessor.id is null or successor.id is null then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(predecessor);
  if predecessor.firm_id <> successor.firm_id then raise exception 'Tasks must belong to the same firm'; end if;
  if not public.crm_task_actor_can_manage(predecessor) then raise exception 'Forbidden'; end if;
  if exists (
    with recursive chain(id) as (
      select successor.id union select dependency.successor_task_id
      from public.crm_task_dependencies dependency join chain on dependency.predecessor_task_id = chain.id
    ) select 1 from chain where id = predecessor.id
  ) then raise exception 'Task dependencies cannot contain cycles'; end if;
  insert into public.crm_task_dependencies(firm_id, predecessor_task_id, successor_task_id, created_by)
  values (predecessor.firm_id, predecessor.id, successor.id, auth.uid()) returning * into created_dependency;
  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values (predecessor.firm_id, successor.id, 'dependency_added', jsonb_build_object('predecessor_task_id', predecessor.id));
  return created_dependency;
end;
$$;

create or replace function public.crm_remove_task_dependency(target_dependency_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare current_dependency public.crm_task_dependencies; predecessor public.crm_tasks;
begin
  select * into current_dependency from public.crm_task_dependencies where id = target_dependency_id for update;
  if not found then raise exception 'Dependency not found'; end if;
  select * into predecessor from public.crm_tasks where id = current_dependency.predecessor_task_id;
  perform public.crm_assert_task_member(predecessor);
  if not public.crm_task_actor_can_manage(predecessor) then raise exception 'Forbidden'; end if;
  delete from public.crm_task_dependencies where id = current_dependency.id;
end;
$$;

alter table public.crm_task_messages enable row level security;
alter table public.crm_task_evidences enable row level security;
alter table public.crm_task_dependencies enable row level security;
alter table public.crm_task_inbox_items enable row level security;
create policy crm_task_messages_read on public.crm_task_messages for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_task_evidences_read on public.crm_task_evidences for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_task_dependencies_read on public.crm_task_dependencies for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_task_inbox_items_own on public.crm_task_inbox_items for all to authenticated
  using (user_id = (select auth.uid()) and public.crm_is_firm_member(firm_id))
  with check (user_id = (select auth.uid()) and public.crm_is_firm_member(firm_id));

revoke insert, update, delete on public.crm_tasks from authenticated;
revoke all on public.crm_task_messages, public.crm_task_evidences, public.crm_task_dependencies from public, anon, authenticated;
grant select on public.crm_task_messages, public.crm_task_evidences, public.crm_task_dependencies to authenticated;
grant select, insert, update, delete on public.crm_task_inbox_items to authenticated;

revoke all on function public.crm_task_actor_can_manage(public.crm_tasks) from public, anon, authenticated;
revoke all on function public.crm_assert_task_member(public.crm_tasks) from public, anon, authenticated;
revoke all on function public.crm_create_task(uuid, uuid, uuid, text, text, text, public.crm_priority, timestamptz, timestamptz, uuid, text, text, uuid, jsonb) from public, anon;
revoke all on function public.crm_open_task(uuid) from public, anon;
revoke all on function public.crm_update_task(uuid, integer, text, text, public.crm_task_status, public.crm_priority, timestamptz, timestamptz, uuid) from public, anon;
revoke all on function public.crm_set_task_status(uuid, integer, public.crm_task_status, text, text) from public, anon;
revoke all on function public.crm_put_task_on_hold(uuid, integer, text, timestamptz, text) from public, anon;
revoke all on function public.crm_reactivate_waiting_tasks() from public, anon;
revoke all on function public.crm_complete_task(uuid, integer, text, text) from public, anon;
revoke all on function public.crm_complete_and_unlock(uuid, integer, text, text) from public, anon;
revoke all on function public.crm_set_next_action(uuid, integer, boolean) from public, anon;
revoke all on function public.crm_add_task_message(uuid, text) from public, anon;
revoke all on function public.crm_add_task_evidence(uuid, text, uuid) from public, anon;
revoke all on function public.crm_create_task_dependency(uuid, uuid) from public, anon;
revoke all on function public.crm_remove_task_dependency(uuid) from public, anon;
grant execute on function public.crm_create_task(uuid, uuid, uuid, text, text, text, public.crm_priority, timestamptz, timestamptz, uuid, text, text, uuid, jsonb), public.crm_open_task(uuid), public.crm_update_task(uuid, integer, text, text, public.crm_task_status, public.crm_priority, timestamptz, timestamptz, uuid), public.crm_set_task_status(uuid, integer, public.crm_task_status, text, text), public.crm_put_task_on_hold(uuid, integer, text, timestamptz, text), public.crm_reactivate_waiting_tasks(), public.crm_complete_task(uuid, integer, text, text), public.crm_complete_and_unlock(uuid, integer, text, text), public.crm_set_next_action(uuid, integer, boolean), public.crm_add_task_message(uuid, text), public.crm_add_task_evidence(uuid, text, uuid), public.crm_create_task_dependency(uuid, uuid), public.crm_remove_task_dependency(uuid) to authenticated;

notify pgrst, 'reload schema';