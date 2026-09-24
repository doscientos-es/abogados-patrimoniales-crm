create or replace function public.crm_update_special_meeting(
  target_task_id uuid,
  target_expected_version integer,
  new_meeting_details jsonb
)
returns public.crm_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  current_task public.crm_tasks;
  saved_task public.crm_tasks;
  current_status text;
  next_status text;
begin
  select * into current_task
  from public.crm_tasks
  where id = target_task_id
  for update;

  if not found or current_task.kind <> 'event' then
    raise exception 'Special meeting task not found';
  end if;
  perform public.crm_assert_task_member(current_task);
  if not public.crm_task_actor_can_manage(current_task)
    and not (new_meeting_details ->> 'status' in ('in_progress', 'finished') and public.crm_task_actor_can_work(current_task)) then
    raise exception 'Forbidden';
  end if;
  if current_task.version <> target_expected_version then
    raise exception 'Task changed by another user; reload before saving' using errcode = '40001';
  end if;
  if jsonb_typeof(new_meeting_details) <> 'object'
    or new_meeting_details ->> 'specialType' <> 'meeting' then
    raise exception 'Invalid special meeting details';
  end if;

  current_status := coalesce(current_task.meeting_details ->> 'status', 'preparation');
  next_status := coalesce(new_meeting_details ->> 'status', 'preparation');
  if next_status not in ('preparation', 'scheduled', 'in_progress', 'finished', 'cancelled', 'not_held') then
    raise exception 'Invalid special meeting status';
  end if;
  if next_status is distinct from current_status and not (
    (current_status = 'preparation' and next_status in ('scheduled', 'cancelled', 'not_held'))
    or (current_status = 'scheduled' and next_status in ('preparation', 'in_progress', 'cancelled', 'not_held'))
    or (current_status = 'in_progress' and next_status in ('finished', 'cancelled', 'not_held'))
  ) then
    raise exception 'Invalid special meeting status transition';
  end if;
  if next_status in ('cancelled', 'not_held') and next_status is distinct from current_status
    and nullif(trim(coalesce(new_meeting_details ->> 'statusReason', '')), '') is null then
    raise exception 'A reason is required to cancel or mark a meeting as not held';
  end if;
  if next_status in ('scheduled', 'in_progress', 'finished') then
    if nullif(trim(coalesce(new_meeting_details ->> 'startsAt', '')), '') is null
      or nullif(trim(coalesce(new_meeting_details ->> 'endsAt', '')), '') is null
      or coalesce(new_meeting_details ->> 'mode', '') not in ('office_bilbao', 'office_recalde', 'phone', 'outside_office')
      or (new_meeting_details ->> 'endsAt')::timestamptz <= (new_meeting_details ->> 'startsAt')::timestamptz then
      raise exception 'Scheduling requires a valid start, end and mode';
    end if;
  end if;

  update public.crm_tasks
  set meeting_details = new_meeting_details,
      due_at = case
        when next_status in ('scheduled', 'in_progress', 'finished') then (new_meeting_details ->> 'startsAt')::timestamptz
        when next_status in ('preparation', 'cancelled', 'not_held') then null
        else due_at
      end
  where id = current_task.id
  returning * into saved_task;

  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values (
    saved_task.firm_id,
    saved_task.id,
    'meeting_changed',
    jsonb_build_object('status', next_status, 'previousStatus', current_status)
  );
  return saved_task;
end;
$$;

revoke all on function public.crm_update_special_meeting(uuid, integer, jsonb) from public, anon;
grant execute on function public.crm_update_special_meeting(uuid, integer, jsonb) to authenticated;
notify pgrst, 'reload schema';