create or replace function public.crm_assert_active_task_assignee(target_firm_id uuid, target_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if target_user_id is not null and not exists (
    select 1 from public.crm_firm_members member
    where member.firm_id = target_firm_id and member.user_id = target_user_id and member.status = 'active'
  ) then raise exception 'The responsible user must be an active firm member'; end if;
end;
$$;

create or replace function public.crm_task_is_blocked(target_task_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.crm_task_dependencies dependency
    join public.crm_tasks predecessor on predecessor.id = dependency.predecessor_task_id
    where dependency.successor_task_id = target_task_id and predecessor.status <> 'completed'
  );
$$;

create or replace function public.crm_validate_task_execution()
returns trigger language plpgsql set search_path = public as $$
begin
  perform public.crm_assert_active_task_assignee(new.firm_id, new.assigned_to);
  if new.status in ('in_progress', 'completed') and public.crm_task_is_blocked(new.id) then
    raise exception 'A blocked task cannot be started or completed';
  end if;
  return new;
end;
$$;

create or replace function public.crm_log_unblocked_task_successors()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    insert into public.crm_task_events(firm_id, task_id, event_type, payload)
    select dependency.firm_id, dependency.successor_task_id, 'dependency_unblocked',
      jsonb_build_object('predecessor_task_id', new.id)
    from public.crm_task_dependencies dependency
    where dependency.predecessor_task_id = new.id and not public.crm_task_is_blocked(dependency.successor_task_id);
  end if;
  return null;
end;
$$;

drop trigger if exists crm_tasks_validate_execution on public.crm_tasks;
create trigger crm_tasks_validate_execution before insert or update of status, assigned_to on public.crm_tasks
  for each row execute function public.crm_validate_task_execution();
drop trigger if exists crm_tasks_log_unblocked_successors on public.crm_tasks;
create trigger crm_tasks_log_unblocked_successors after update of status on public.crm_tasks
  for each row execute function public.crm_log_unblocked_task_successors();

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
      and status in ('pending', 'in_progress', 'waiting') and (
        (current_task.case_id is not null and case_id = current_task.case_id) or
        (current_task.opportunity_id is not null and opportunity_id = current_task.opportunity_id)
      );
  end if;
  update public.crm_tasks set is_next_action = enabled where id = current_task.id returning * into saved_task;
  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values (saved_task.firm_id, saved_task.id, 'next_action_changed', jsonb_build_object('enabled', enabled));
  return saved_task;
end;
$$;

create or replace function public.crm_reassign_task(
  target_task_id uuid, target_expected_version integer, new_assigned_to uuid
)
returns public.crm_tasks language plpgsql security definer set search_path = public as $$
declare current_task public.crm_tasks; saved_task public.crm_tasks;
begin
  select * into current_task from public.crm_tasks where id = target_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if not public.crm_task_actor_can_manage(current_task) then raise exception 'Only the requester or an administrator can reassign this task'; end if;
  if current_task.version <> target_expected_version then raise exception 'Task changed by another user; reload before saving' using errcode = '40001'; end if;
  perform public.crm_assert_active_task_assignee(current_task.firm_id, new_assigned_to);
  update public.crm_tasks set assigned_to = new_assigned_to, opened_at = null, opened_by = null
  where id = current_task.id returning * into saved_task;
  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values (saved_task.firm_id, saved_task.id, 'reassigned', jsonb_build_object('assigned_to', new_assigned_to));
  return saved_task;
end;
$$;

create or replace function public.crm_reject_task(
  target_task_id uuid, target_expected_version integer, reason text
)
returns public.crm_tasks language plpgsql security definer set search_path = public as $$
declare current_task public.crm_tasks; saved_task public.crm_tasks;
begin
  select * into current_task from public.crm_tasks where id = target_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if current_task.assigned_to is distinct from auth.uid() and not public.crm_task_actor_can_manage(current_task) then raise exception 'Only the responsible user or requester can reject this task'; end if;
  if current_task.version <> target_expected_version then raise exception 'Task changed by another user; reload before saving' using errcode = '40001'; end if;
  if nullif(trim(reason), '') is null then raise exception 'Rejection reason is required'; end if;
  update public.crm_tasks set rejection_reason = trim(reason), rejected_at = now()
  where id = current_task.id returning * into saved_task;
  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values (saved_task.firm_id, saved_task.id, 'rejected', jsonb_build_object('reason', trim(reason)));
  return saved_task;
end;
$$;

revoke all on function public.crm_assert_active_task_assignee(uuid, uuid), public.crm_task_is_blocked(uuid) from public, anon, authenticated;
revoke all on function public.crm_reassign_task(uuid, integer, uuid), public.crm_reject_task(uuid, integer, text) from public, anon;
grant execute on function public.crm_reassign_task(uuid, integer, uuid), public.crm_reject_task(uuid, integer, text) to authenticated;
notify pgrst, 'reload schema';