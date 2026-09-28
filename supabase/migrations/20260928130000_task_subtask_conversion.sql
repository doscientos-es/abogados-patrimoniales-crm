-- Link a checklist entry with the task created from it, keeping traceability on both tasks.
create or replace function public.crm_mark_task_subtask_converted(
  target_task_id uuid,
  target_subtask_id uuid,
  converted_task_id uuid
)
returns public.crm_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  current_task public.crm_tasks;
  new_task public.crm_tasks;
  saved_task public.crm_tasks;
  current_subtasks jsonb;
  updated_subtasks jsonb;
  subtask_text text;
  already_converted boolean;
begin
  if target_task_id = converted_task_id then raise exception 'A task cannot be converted into itself'; end if;

  select * into current_task
  from public.crm_tasks
  where id = target_task_id
  for update;

  if not found then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if not public.crm_task_actor_can_work(current_task) then raise exception 'Forbidden'; end if;

  select * into new_task
  from public.crm_tasks
  where id = converted_task_id
  for update;

  if not found or new_task.firm_id <> current_task.firm_id then
    raise exception 'Converted task not found';
  end if;
  if new_task.created_by is distinct from auth.uid() then raise exception 'Forbidden'; end if;

  current_subtasks := current_task.details -> 'subtasks';
  if current_subtasks is null or jsonb_typeof(current_subtasks) <> 'array' then
    raise exception 'Task checklist entry not found';
  end if;

  select item ->> 'text', coalesce(item ->> 'converted_to', '') <> ''
  into subtask_text, already_converted
  from jsonb_array_elements(current_subtasks) as checklist(item)
  where item ->> 'id' = target_subtask_id::text;

  if subtask_text is null then raise exception 'Task checklist entry not found'; end if;
  if already_converted then raise exception 'Checklist entry already converted into a task'; end if;

  select jsonb_agg(
    case
      when item ->> 'id' = target_subtask_id::text then item || jsonb_build_object(
        'converted_to', converted_task_id,
        'converted_by', auth.uid(),
        'converted_at', now()
      )
      else item
    end
    order by ordinal
  )
  into updated_subtasks
  from jsonb_array_elements(current_subtasks) with ordinality as checklist(item, ordinal);

  update public.crm_tasks
  set details = jsonb_set(current_task.details, '{subtasks}', updated_subtasks, true)
  where id = current_task.id
  returning * into saved_task;

  update public.crm_tasks
  set
    parent_task_id = coalesce(parent_task_id, current_task.id),
    details = details || jsonb_build_object(
      'origin_subtask',
      jsonb_build_object('task_id', current_task.id, 'subtask_id', target_subtask_id)
    )
  where id = new_task.id;

  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values
    (
      saved_task.firm_id,
      saved_task.id,
      'subtask_converted',
      jsonb_build_object(
        'subtask_id', target_subtask_id,
        'text', subtask_text,
        'converted_task_id', converted_task_id
      )
    ),
    (
      saved_task.firm_id,
      new_task.id,
      'created_from_subtask',
      jsonb_build_object('source_task_id', current_task.id, 'subtask_id', target_subtask_id)
    );

  return saved_task;
end;
$$;

revoke all on function public.crm_mark_task_subtask_converted(uuid, uuid, uuid) from public, anon;
grant execute on function public.crm_mark_task_subtask_converted(uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
