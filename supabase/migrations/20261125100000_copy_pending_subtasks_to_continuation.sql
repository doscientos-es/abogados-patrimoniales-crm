-- Copy pending, non-converted checklist entries atomically when completing a next action.
-- The original checklist remains unchanged as historical evidence.
create or replace function public.crm_complete_task(
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
declare
  current_task public.crm_tasks;
  saved_task public.crm_tasks;
  continuation public.crm_tasks;
  source_subtasks jsonb;
  copied_subtasks jsonb := '[]'::jsonb;
begin
  select * into current_task from public.crm_tasks where id = target_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if not public.crm_task_actor_can_work(current_task) then raise exception 'Forbidden'; end if;
  if current_task.version <> target_expected_version then
    raise exception 'Task changed by another user; reload before saving' using errcode = '40001';
  end if;
  if nullif(trim(result_text), '') is null then raise exception 'Completion result is required'; end if;
  if coalesce(task_relevance, 'normal') not in ('normal', 'activity', 'milestone') then
    raise exception 'Invalid task relevance';
  end if;
  if current_task.is_next_action and (
    continuity_decision is null or continuity_decision not in (
      'create_next_task', 'create_next_task_with_subtasks', 'close_without_continuity'
    )
  ) then raise exception 'Next actions require a continuity decision'; end if;
  if continuity_decision = 'create_next_task_with_subtasks' then
    if not current_task.is_next_action then raise exception 'Only next actions can create a continuation'; end if;
    source_subtasks := coalesce(current_task.details -> 'subtasks', '[]'::jsonb);
    if jsonb_typeof(source_subtasks) <> 'array' then raise exception 'Task checklist data is invalid'; end if;
    select coalesce(jsonb_agg(
      item || jsonb_build_object(
        'id', gen_random_uuid(), 'origin_task_id', current_task.id, 'origin_subtask_id', item ->> 'id'
      ) order by ordinal
    ), '[]'::jsonb)
    into copied_subtasks
    from jsonb_array_elements(source_subtasks) with ordinality as checklist(item, ordinal)
    where item -> 'done' = 'false'::jsonb and coalesce(item ->> 'converted_to', '') = '';
  end if;

  update public.crm_tasks set status = 'completed', completed_at = coalesce(completed_at, now()),
    completion_result = trim(result_text), relevance = coalesce(task_relevance, 'normal')
    where id = current_task.id returning * into saved_task;
  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values (saved_task.firm_id, saved_task.id, 'completed',
    jsonb_build_object('continuity', continuity_decision, 'relevance', saved_task.relevance));
  if current_task.is_next_action and continuity_decision in ('create_next_task', 'create_next_task_with_subtasks') then
    insert into public.crm_tasks (
      firm_id, case_id, opportunity_id, workstream_id, kind, title, description,
      priority, assigned_to, parent_task_id, is_next_action, validation_status, details
    ) values (
      current_task.firm_id, current_task.case_id, current_task.opportunity_id,
      current_task.workstream_id, 'task', 'Continuación: ' || current_task.title, '',
      current_task.priority, current_task.assigned_to, current_task.id, true, 'not_required',
      case when continuity_decision = 'create_next_task_with_subtasks'
        then jsonb_build_object('subtasks', copied_subtasks) else '{}'::jsonb end
    ) returning * into continuation;
    insert into public.crm_task_events(firm_id, task_id, event_type, payload)
    values (continuation.firm_id, continuation.id, 'created',
      jsonb_build_object('status', continuation.status, 'parent_task_id', current_task.id));
    insert into public.crm_task_events(firm_id, task_id, event_type, payload)
    values (continuation.firm_id, continuation.id, 'continuation_created',
      jsonb_build_object('parent_task_id', current_task.id, 'copied_subtasks', jsonb_array_length(copied_subtasks)));
  end if;
  return saved_task;
end;
$$;

notify pgrst, 'reload schema';