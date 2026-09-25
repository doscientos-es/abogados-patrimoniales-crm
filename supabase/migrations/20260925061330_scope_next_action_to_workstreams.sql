-- A case and each of its workstreams are independent next-action contexts.
drop index if exists public.crm_tasks_one_open_next_action_per_case_idx;

create unique index crm_tasks_one_open_next_action_per_case_idx
  on public.crm_tasks(firm_id, case_id)
  where is_next_action
    and case_id is not null
    and workstream_id is null
    and status in ('pending', 'in_progress', 'waiting');

create unique index crm_tasks_one_open_next_action_per_workstream_idx
  on public.crm_tasks(firm_id, case_id, workstream_id)
  where is_next_action
    and case_id is not null
    and workstream_id is not null
    and status in ('pending', 'in_progress', 'waiting');

create or replace function public.crm_set_next_action(
  target_task_id uuid,
  target_expected_version integer,
  enabled boolean
)
returns public.crm_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  current_task public.crm_tasks;
  saved_task public.crm_tasks;
begin
  select * into current_task
  from public.crm_tasks
  where id = target_task_id
  for update;
  if not found then raise exception 'Task not found'; end if;

  perform public.crm_assert_task_member(current_task);
  if not public.crm_task_actor_can_manage(current_task) then
    raise exception 'Only the requester or an administrator can choose the next action';
  end if;
  if current_task.version <> target_expected_version then
    raise exception 'Task changed by another user; reload before saving' using errcode = '40001';
  end if;
  if enabled and current_task.status in ('completed', 'cancelled') then
    raise exception 'Only open tasks can be the next action';
  end if;

  if enabled then
    update public.crm_tasks
    set is_next_action = false
    where firm_id = current_task.firm_id
      and id <> current_task.id
      and is_next_action
      and status in ('pending', 'in_progress', 'waiting')
      and (
        (current_task.workstream_id is not null and workstream_id = current_task.workstream_id)
        or (
          current_task.workstream_id is null
          and current_task.case_id is not null
          and case_id = current_task.case_id
          and workstream_id is null
        )
        or (
          current_task.opportunity_id is not null
          and opportunity_id = current_task.opportunity_id
        )
      );
  end if;

  update public.crm_tasks
  set is_next_action = enabled
  where id = current_task.id
  returning * into saved_task;

  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values (
    saved_task.firm_id,
    saved_task.id,
    'next_action_changed',
    jsonb_build_object('enabled', enabled)
  );
  return saved_task;
end;
$$;

revoke all on function public.crm_set_next_action(uuid, integer, boolean) from public, anon;
grant execute on function public.crm_set_next_action(uuid, integer, boolean) to authenticated;

notify pgrst, 'reload schema';