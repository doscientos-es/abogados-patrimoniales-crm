-- Meeting requests need an actionable notification even when the requester is
-- also responsible. Other self-assigned tasks retain their existing behaviour.
create or replace function public.crm_notify_self_assigned_meeting_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare current_task public.crm_tasks;
begin
  if new.created_by is null or new.assigned_to is distinct from new.created_by then
    return null;
  end if;

  select * into current_task from public.crm_tasks where id = new.id;
  if not found or current_task.assigned_to is distinct from new.assigned_to
    or current_task.kind <> 'event'
    or current_task.meeting_details ->> 'specialType' is distinct from 'meeting'
    or current_task.meeting_details ->> 'status' is distinct from 'preparation'
    or not exists (
      select 1 from public.crm_firm_members member
      where member.firm_id = current_task.firm_id
        and member.user_id = current_task.assigned_to and member.status = 'active'
    ) then
    return null;
  end if;

  insert into public.crm_notifications(
    firm_id, recipient_id, actor_id, task_id, task_title, kind, body
  ) values (
    current_task.firm_id, current_task.assigned_to, new.created_by,
    current_task.id, current_task.title, 'task_assignment',
    'Has solicitado una cita. Confirma los detalles para programarla.'
  );
  return null;
end;
$$;

revoke all on function public.crm_notify_self_assigned_meeting_request() from public, anon, authenticated;
create constraint trigger crm_tasks_notify_self_assigned_meeting_request
  after insert on public.crm_tasks
  deferrable initially deferred
  for each row when (new.assigned_to is not null)
  execute function public.crm_notify_self_assigned_meeting_request();