-- Persist workstream context and the critical flag for tasks created from any
-- workflow. The two trailing arguments remain optional for older clients.
drop function if exists public.crm_create_task(
  uuid, uuid, uuid, text, text, text, public.crm_priority,
  timestamptz, timestamptz, uuid, text, text, uuid, jsonb
);

create function public.crm_create_task(
  target_firm_id uuid,
  target_case_id uuid,
  target_opportunity_id uuid,
  new_kind text,
  new_title text,
  new_description text,
  new_priority public.crm_priority,
  new_due_at timestamptz,
  new_reminder_at timestamptz,
  new_assigned_to uuid,
  new_deadline_class text default null,
  initial_message text default null,
  new_parent_task_id uuid default null,
  new_meeting_details jsonb default '{}'::jsonb,
  new_workstream_id uuid default null,
  new_critical boolean default false
)
returns public.crm_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  created_task public.crm_tasks;
  current_workstream public.crm_case_workstreams;
begin
  if auth.uid() is null or not public.crm_is_firm_member(target_firm_id) then
    raise exception 'Forbidden';
  end if;
  if nullif(trim(new_title), '') is null then raise exception 'Title is required'; end if;
  if target_case_id is null and target_opportunity_id is null then
    raise exception 'Task context is required';
  end if;
  if new_kind not in ('task', 'reminder', 'event', 'deadline') then
    raise exception 'Invalid task kind';
  end if;
  if new_kind = 'deadline' and (new_due_at is null or new_deadline_class not in ('judicial', 'extrajudicial')) then
    raise exception 'Deadlines require a due date and class';
  end if;
  if jsonb_typeof(coalesce(new_meeting_details, '{}'::jsonb)) <> 'object' then
    raise exception 'Meeting details must be an object';
  end if;
  if new_workstream_id is not null then
    if target_case_id is null or target_opportunity_id is not null then
      raise exception 'A workstream task must belong to a case';
    end if;
    select * into current_workstream
    from public.crm_case_workstreams
    where id = new_workstream_id
      and firm_id = target_firm_id
      and case_id = target_case_id
    for share;
    if not found then raise exception 'Workstream must belong to the task case and firm'; end if;
  end if;

  insert into public.crm_tasks (
    firm_id, case_id, opportunity_id, workstream_id, kind, title, description,
    priority, due_at, due_on, reminder_at, assigned_to, deadline_class,
    validation_status, critical, parent_task_id, meeting_details
  ) values (
    target_firm_id, target_case_id, target_opportunity_id, new_workstream_id,
    new_kind, trim(new_title), coalesce(new_description, ''),
    coalesce(new_priority, 'medium'), new_due_at,
    new_due_at at time zone 'Europe/Madrid', new_reminder_at, new_assigned_to,
    new_deadline_class,
    case when new_kind = 'deadline' then 'proposed' else 'not_required' end,
    coalesce(new_critical, false), new_parent_task_id,
    coalesce(new_meeting_details, '{}'::jsonb)
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

revoke all on function public.crm_create_task(
  uuid, uuid, uuid, text, text, text, public.crm_priority,
  timestamptz, timestamptz, uuid, text, text, uuid, jsonb, uuid, boolean
) from public, anon;
grant execute on function public.crm_create_task(
  uuid, uuid, uuid, text, text, text, public.crm_priority,
  timestamptz, timestamptz, uuid, text, text, uuid, jsonb, uuid, boolean
) to authenticated;

notify pgrst, 'reload schema';