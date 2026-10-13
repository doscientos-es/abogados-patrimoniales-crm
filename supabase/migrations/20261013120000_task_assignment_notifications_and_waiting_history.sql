-- Notify the new task assignee without duplicating a manually supplied assignment message.
create or replace function public.crm_notify_task_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_task public.crm_tasks;
  actor uuid := coalesce(auth.uid(), new.created_by);
  actor_label text;
  saved_message public.crm_task_messages;
  body_text text;
  is_reassignment boolean := tg_op = 'UPDATE';
begin
  select * into current_task from public.crm_tasks where id = new.id;
  if not found then return null; end if;
  if current_task.assigned_to is null
    or current_task.assigned_to is distinct from new.assigned_to
    or current_task.assigned_to is not distinct from actor then
    return null;
  end if;
  if is_reassignment and old.assigned_to is not distinct from new.assigned_to then
    return null;
  end if;
  if not exists (
    select 1 from public.crm_firm_members member
    where member.firm_id = current_task.firm_id
      and member.user_id = current_task.assigned_to
      and member.status = 'active'
  ) then
    return null;
  end if;
  if not is_reassignment and exists (
    select 1 from public.crm_task_messages message
    where message.task_id = current_task.id
      and message.message_type = 'initial_assignment'
  ) then
    return null;
  end if;
  if exists (
    select 1 from public.crm_notifications notification
    where notification.task_id = current_task.id
      and notification.recipient_id = current_task.assigned_to
      and notification.kind = 'task_assignment'
      and notification.created_at = now()
  ) then
    return null;
  end if;

  select nullif(trim(profile.display_name), '') into actor_label
  from public.crm_profiles profile where profile.id = actor;
  actor_label := coalesce(actor_label, 'LEX');
  body_text := actor_label
    || case when is_reassignment then ' te ha reasignado: ' else ' te ha asignado: ' end
    || current_task.title;

  insert into public.crm_task_messages(firm_id, task_id, author_id, body, message_type)
  values (current_task.firm_id, current_task.id, actor, body_text, 'system')
  returning * into saved_message;

  insert into public.crm_notifications(
    firm_id, recipient_id, actor_id, actor_name, task_id, task_title, message_id, kind, body
  ) values (
    current_task.firm_id, current_task.assigned_to, actor, actor_label, current_task.id,
    current_task.title, saved_message.id, 'task_assignment', left(body_text, 280)
  );
  return null;
end;
$$;

revoke all on function public.crm_notify_task_assignee() from public, anon, authenticated;

drop trigger if exists crm_tasks_notify_assignee_insert on public.crm_tasks;
create constraint trigger crm_tasks_notify_assignee_insert
  after insert on public.crm_tasks
  deferrable initially deferred
  for each row when (new.assigned_to is not null)
  execute function public.crm_notify_task_assignee();

drop trigger if exists crm_tasks_notify_assignee_update on public.crm_tasks;
create constraint trigger crm_tasks_notify_assignee_update
  after update of assigned_to on public.crm_tasks
  deferrable initially deferred
  for each row when (new.assigned_to is not null and old.assigned_to is distinct from new.assigned_to)
  execute function public.crm_notify_task_assignee();

-- Extend the existing waiting event with the information shown in the task history.
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
  if current_task.assigned_to is distinct from auth.uid()
    and not public.crm_task_actor_can_manage(current_task) then
    raise exception 'Forbidden';
  end if;
  if current_task.version <> target_expected_version then
    raise exception 'Task changed by another user; reload before saving' using errcode = '40001';
  end if;
  if nullif(trim(reason), '') is null or review_at is null then
    raise exception 'Waiting tasks require a reason and review date';
  end if;
  update public.crm_tasks set status = 'waiting', waiting_reason = trim(reason),
    waiting_until = review_at, waiting_detail = trim(coalesce(detail, ''))
  where id = current_task.id returning * into saved_task;
  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values (saved_task.firm_id, saved_task.id, 'waiting_started', jsonb_build_object(
    'review_at', review_at, 'reason', trim(reason), 'detail', trim(coalesce(detail, ''))
  ));
  return saved_task;
end;
$$;