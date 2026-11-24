create or replace function public.crm_update_special_meeting(
  target_task_id uuid, target_expected_version integer, new_meeting_details jsonb
)
returns public.crm_tasks
language plpgsql security definer set search_path = public
as $$
declare
  current_task public.crm_tasks;
  saved_task public.crm_tasks;
  follow_up public.crm_tasks;
  old_details jsonb;
  current_status text;
  next_status text;
  actor_id uuid := auth.uid();
  follow_up_id uuid;
  is_scheduler boolean;
  is_follow_up boolean;
  is_host boolean;
  history jsonb;
  previous_count integer;
begin
  select * into current_task from public.crm_tasks where id = target_task_id for update;
  if not found or current_task.kind <> 'event' then raise exception 'Special meeting task not found'; end if;
  perform public.crm_assert_task_member(current_task);
  if current_task.version <> target_expected_version then
    raise exception 'Task changed by another user; reload before saving' using errcode = '40001';
  end if;
  if jsonb_typeof(new_meeting_details) is distinct from 'object'
    or new_meeting_details ->> 'specialType' is distinct from 'meeting' then
    raise exception 'Invalid special meeting details';
  end if;

  old_details := coalesce(current_task.meeting_details, '{}'::jsonb);
  current_status := coalesce(old_details ->> 'status', 'preparation');
  next_status := coalesce(new_meeting_details ->> 'status', 'preparation');
  is_scheduler := coalesce(actor_id = current_task.assigned_to, false)
    and current_status in ('preparation', 'scheduled') and next_status in ('preparation', 'scheduled');
  is_follow_up := current_status = 'finished' and next_status = 'finished'
    and coalesce(old_details ->> 'followUpAssigneeId' = actor_id::text, false)
    and (old_details - array['transcription', 'receivedDocuments'])
      = (new_meeting_details - array['transcription', 'receivedDocuments']);
  is_host := coalesce(old_details ->> 'abogadoPrimeraCitaId' = actor_id::text, false)
    or coalesce((old_details -> 'attendeeUserIds') ? actor_id::text, false);
  if not public.crm_task_actor_can_manage(current_task) and not is_scheduler and not is_follow_up
    and not ((coalesce(public.crm_task_actor_can_work(current_task), false) or is_host)
      and next_status in ('in_progress', 'finished')) then
    raise exception 'Forbidden';
  end if;

  if next_status not in ('preparation', 'scheduled', 'in_progress', 'finished', 'cancelled', 'not_held')
    or (next_status <> current_status and not (
      (current_status = 'preparation' and next_status in ('scheduled', 'cancelled', 'not_held'))
      or (current_status = 'scheduled' and next_status in ('preparation', 'in_progress', 'cancelled', 'not_held'))
      or (current_status = 'in_progress' and next_status in ('finished', 'cancelled', 'not_held'))
    )) then raise exception 'Invalid special meeting status transition'; end if;
  if next_status in ('cancelled', 'not_held') and next_status <> current_status
    and nullif(trim(new_meeting_details ->> 'statusReason'), '') is null then
    raise exception 'A reason is required to cancel or mark a meeting as not held';
  end if;
  if current_status = 'scheduled' and next_status = 'preparation' then
    history := new_meeting_details -> 'rescheduleHistory';
    previous_count := case when jsonb_typeof(old_details -> 'rescheduleHistory') = 'array'
      then jsonb_array_length(old_details -> 'rescheduleHistory') else 0 end;
    if jsonb_typeof(history) is distinct from 'array' then raise exception 'A rescheduling history entry is required'; end if;
    if jsonb_array_length(history) <= previous_count or nullif(trim(history -> -1 ->> 'reason'), '') is null then
      raise exception 'A rescheduling reason is required';
    end if;
    new_meeting_details := new_meeting_details - 'confirmedAt';
  end if;
  if next_status in ('scheduled', 'in_progress', 'finished') then
    if nullif(trim(new_meeting_details ->> 'startsAt'), '') is null
      or nullif(trim(new_meeting_details ->> 'endsAt'), '') is null
      or coalesce(new_meeting_details ->> 'mode', '') not in ('office_bilbao', 'office_recalde', 'phone', 'outside_office')
      or (new_meeting_details ->> 'endsAt')::timestamptz <= (new_meeting_details ->> 'startsAt')::timestamptz then
      raise exception 'Scheduling requires a valid start, end and mode';
    end if;
  end if;
  if current_status = 'preparation' and next_status = 'scheduled' then
    new_meeting_details := new_meeting_details || jsonb_build_object('confirmedAt', now());
  end if;

  if current_status = 'in_progress' and next_status = 'finished' then
    follow_up_id := nullif(new_meeting_details ->> 'followUpAssigneeId', '')::uuid;
    new_meeting_details := new_meeting_details - array['followUpAssigneeId', 'followUpTaskId'];
    if follow_up_id is not null then
      if not exists (select 1 from public.crm_firm_members
        where firm_id = current_task.firm_id and user_id = follow_up_id and status = 'active') then
        raise exception 'El responsable administrativo no pertenece al despacho.';
      end if;
      follow_up := public.crm_create_task(
        current_task.firm_id, current_task.case_id,
        case when current_task.case_id is null then current_task.opportunity_id else null end,
        'task', 'Completar documentación de la cita',
        'Abre la cita vinculada y añade los documentos y la transcripción disponibles.',
        'medium', null, null, follow_up_id, null, null, current_task.id
      );
      new_meeting_details := new_meeting_details || jsonb_build_object(
        'followUpAssigneeId', follow_up_id, 'followUpTaskId', follow_up.id);
    end if;
  else
    new_meeting_details := (new_meeting_details - array['followUpAssigneeId', 'followUpTaskId'])
      || jsonb_strip_nulls(jsonb_build_object(
        'followUpAssigneeId', old_details -> 'followUpAssigneeId', 'followUpTaskId', old_details -> 'followUpTaskId'));
  end if;

  update public.crm_tasks
  set meeting_details = new_meeting_details,
      due_at = case when next_status in ('scheduled', 'in_progress', 'finished')
        then (new_meeting_details ->> 'startsAt')::timestamptz else null end
  where id = current_task.id returning * into saved_task;

  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values (saved_task.firm_id, saved_task.id, 'meeting_changed',
    jsonb_build_object('status', next_status, 'previousStatus', current_status));
  return saved_task;
end;
$$;

notify pgrst, 'reload schema';