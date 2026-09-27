-- Persist task checklist entries in the task details document with versioned RPCs.
create or replace function public.crm_add_task_subtask(
  target_task_id uuid,
  target_expected_version integer,
  subtask_text text
)
returns public.crm_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  current_task public.crm_tasks;
  saved_task public.crm_tasks;
  current_subtasks jsonb;
begin
  select * into current_task
  from public.crm_tasks
  where id = target_task_id
  for update;

  if not found then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if not public.crm_task_actor_can_work(current_task) then raise exception 'Forbidden'; end if;
  if current_task.version <> target_expected_version then
    raise exception 'Task changed by another user; reload before saving' using errcode = '40001';
  end if;
  if current_task.status not in ('pending', 'in_progress', 'waiting') then
    raise exception 'Only open tasks can have checklist entries';
  end if;
  if nullif(trim(subtask_text), '') is null then raise exception 'Checklist text is required'; end if;
  if char_length(trim(subtask_text)) > 300 then raise exception 'Checklist text is too long'; end if;

  current_subtasks := current_task.details -> 'subtasks';
  if current_subtasks is null then current_subtasks := '[]'::jsonb; end if;
  if jsonb_typeof(current_subtasks) <> 'array' then
    raise exception 'Task checklist data is invalid';
  end if;
  if jsonb_array_length(current_subtasks) >= 100 then
    raise exception 'A task cannot have more than 100 checklist entries';
  end if;

  update public.crm_tasks
  set details = jsonb_set(
    current_task.details,
    '{subtasks}',
    current_subtasks || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(),
      'text', trim(subtask_text),
      'done', false,
      'created_by', auth.uid(),
      'created_at', now()
    )),
    true
  )
  where id = current_task.id
  returning * into saved_task;

  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values (saved_task.firm_id, saved_task.id, 'subtask_added', jsonb_build_object('text', trim(subtask_text)));

  return saved_task;
end;
$$;

create or replace function public.crm_set_task_subtask_done(
  target_task_id uuid,
  target_expected_version integer,
  target_subtask_id uuid,
  target_done boolean
)
returns public.crm_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  current_task public.crm_tasks;
  saved_task public.crm_tasks;
  current_subtasks jsonb;
  updated_subtasks jsonb;
  subtask_found boolean;
begin
  select * into current_task
  from public.crm_tasks
  where id = target_task_id
  for update;

  if not found then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if not public.crm_task_actor_can_work(current_task) then raise exception 'Forbidden'; end if;
  if current_task.version <> target_expected_version then
    raise exception 'Task changed by another user; reload before saving' using errcode = '40001';
  end if;
  if current_task.status not in ('pending', 'in_progress', 'waiting') then
    raise exception 'Only open tasks can change checklist entries';
  end if;
  if target_done is null then raise exception 'Checklist completion must be specified'; end if;

  current_subtasks := current_task.details -> 'subtasks';
  if current_subtasks is null or jsonb_typeof(current_subtasks) <> 'array' then
    raise exception 'Task checklist entry not found';
  end if;

  select
    jsonb_agg(
      case
        when item ->> 'id' = target_subtask_id::text
          then item || jsonb_build_object('done', target_done)
        else item
      end
      order by ordinal
    ),
    coalesce(bool_or(item ->> 'id' = target_subtask_id::text), false)
  into updated_subtasks, subtask_found
  from jsonb_array_elements(current_subtasks) with ordinality as checklist(item, ordinal);

  if not subtask_found then raise exception 'Task checklist entry not found'; end if;

  update public.crm_tasks
  set details = jsonb_set(current_task.details, '{subtasks}', updated_subtasks, true)
  where id = current_task.id
  returning * into saved_task;

  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values (
    saved_task.firm_id,
    saved_task.id,
    'subtask_toggled',
    jsonb_build_object('subtask_id', target_subtask_id, 'done', target_done)
  );

  return saved_task;
end;
$$;

revoke all on function public.crm_add_task_subtask(uuid, integer, text) from public, anon;
revoke all on function public.crm_set_task_subtask_done(uuid, integer, uuid, boolean) from public, anon;
grant execute on function public.crm_add_task_subtask(uuid, integer, text) to authenticated;
grant execute on function public.crm_set_task_subtask_done(uuid, integer, uuid, boolean) to authenticated;

notify pgrst, 'reload schema';