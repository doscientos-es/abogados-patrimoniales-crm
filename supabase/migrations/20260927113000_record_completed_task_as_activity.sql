-- Record a completed case task as an internal case activity in the same transaction.
create or replace function public.crm_complete_task_as_activity(
  target_task_id uuid,
  target_expected_version integer,
  result_text text,
  continuity_decision text default null
)
returns public.crm_case_activities
language plpgsql
security definer
set search_path = public
as $$
declare
  current_task public.crm_tasks;
  existing_activity public.crm_case_activities;
  saved_activity public.crm_case_activities;
begin
  select * into current_task
  from public.crm_tasks
  where id = target_task_id
  for update;

  if not found then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if not public.crm_task_actor_can_work(current_task) then raise exception 'Forbidden'; end if;
  if current_task.case_id is null then
    raise exception 'Only tasks linked to a case can be recorded as activities';
  end if;

  select * into existing_activity
  from public.crm_case_activities
  where firm_id = current_task.firm_id
    and details ->> 'source_task_id' = current_task.id::text
  limit 1;
  if found then return existing_activity; end if;

  if current_task.status in ('completed', 'cancelled') then
    raise exception 'Only open tasks can be recorded as activities';
  end if;

  perform public.crm_complete_task(
    target_task_id,
    target_expected_version,
    result_text,
    continuity_decision
  );

  insert into public.crm_case_activities (
    firm_id,
    case_id,
    workstream_id,
    activity_type,
    title,
    description,
    occurred_at,
    assigned_to,
    status,
    result,
    details
  ) values (
    current_task.firm_id,
    current_task.case_id,
    current_task.workstream_id,
    'Gestión',
    current_task.title,
    current_task.description,
    now(),
    current_task.assigned_to,
    'Realizada',
    trim(result_text),
    jsonb_build_object('source_task_id', current_task.id)
  ) returning * into saved_activity;

  return saved_activity;
end;
$$;

revoke all on function public.crm_complete_task_as_activity(uuid, integer, text, text) from public, anon;
grant execute on function public.crm_complete_task_as_activity(uuid, integer, text, text) to authenticated;
