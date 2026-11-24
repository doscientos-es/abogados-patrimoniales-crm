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
  host_ids text[];
  lifecycle_keys text[] := array['status', 'statusReason', 'startedAt', 'finishedAt',
    'actualDurationMinutes', 'internalNotes', 'primeraCita', 'followUpAssigneeId', 'derivedTaskTitles'];
  scheduling_keys text[] := array['status', 'statusReason', 'startsAt', 'endsAt', 'mode',
    'location', 'meetingUrl', 'attendeeUserIds', 'durationMinutes', 'preparationItems', 'rescheduleHistory'];
  is_scheduler boolean;
  is_follow_up boolean;
  is_host boolean;
  can_manage boolean;
  can_hold boolean;
  closing boolean;
  derived_titles jsonb;
  derived_title text;
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
  if old_details ->> 'specialType' is distinct from 'meeting'
    and not (current_task.opportunity_id is not null and old_details ? 'primeraCita') then
    raise exception 'Special meeting task not found';
  end if;
  current_status := coalesce(old_details ->> 'status', 'preparation');
  next_status := coalesce(new_meeting_details ->> 'status', 'preparation');
  can_manage := coalesce(public.crm_task_actor_can_manage(current_task), false);
  select coalesce(array_agg(distinct host.id), array[]::text[]) into host_ids
  from (
    select nullif(old_details ->> 'abogadoPrimeraCitaId', '') as id
    union
    select jsonb_array_elements_text(case when jsonb_typeof(old_details -> 'attendeeUserIds') = 'array'
      then old_details -> 'attendeeUserIds' else '[]'::jsonb end)
  ) host where nullif(host.id, '') is not null;
  is_host := actor_id::text = any(host_ids);
  can_hold := is_host or (cardinality(host_ids) = 0 and (can_manage or actor_id = current_task.assigned_to))
    or exists (select 1 from public.crm_firm_members where firm_id = current_task.firm_id
      and user_id = actor_id and status = 'active' and role in ('owner', 'admin'));
  is_scheduler := coalesce(actor_id = current_task.assigned_to, false)
    and current_status = 'preparation' and next_status in ('preparation', 'scheduled', 'cancelled', 'not_held');
  is_follow_up := current_status = 'finished' and next_status = 'finished'
    and coalesce(old_details ->> 'followUpAssigneeId' = actor_id::text, false)
    and (old_details - array['transcription', 'receivedDocuments'])
      = (new_meeting_details - array['transcription', 'receivedDocuments']);
  closing := current_status = 'in_progress' and next_status = 'finished';
  if next_status = 'in_progress' or closing or (current_status = 'scheduled' and next_status = 'not_held' and is_host) then
    if not coalesce(can_hold, false) then raise exception 'Forbidden'; end if;
    if not can_manage then
      new_meeting_details := old_details || coalesce((select jsonb_object_agg(key, value)
        from jsonb_each(new_meeting_details) where key = any(lifecycle_keys)), '{}'::jsonb)
        || jsonb_build_object('specialType', 'meeting');
    end if;
  elsif not can_manage and is_scheduler then
    new_meeting_details := old_details || coalesce((select jsonb_object_agg(key, value)
      from jsonb_each(new_meeting_details) where key = any(scheduling_keys)), '{}'::jsonb);
  elsif not can_manage and not is_follow_up then
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
    select coalesce(array_agg(distinct host.id), array[]::text[]) into host_ids
    from (
      select nullif(new_meeting_details ->> 'abogadoPrimeraCitaId', '') as id
      union
      select jsonb_array_elements_text(case when jsonb_typeof(new_meeting_details -> 'attendeeUserIds') = 'array'
        then new_meeting_details -> 'attendeeUserIds' else '[]'::jsonb end)
    ) host where nullif(host.id, '') is not null;
    if cardinality(host_ids) = 0 or exists (
      select 1 from unnest(host_ids) host(id) where not exists (
        select 1 from public.crm_firm_members member where member.firm_id = current_task.firm_id
          and member.user_id::text = host.id and member.status = 'active')) then
      raise exception 'Selecciona al menos un asistente del despacho con membresía activa.';
    end if;
    new_meeting_details := new_meeting_details || jsonb_build_object('confirmedAt', now(),
      'confirmedBy', actor_id, 'durationMinutes', round(extract(epoch from (
        (new_meeting_details ->> 'endsAt')::timestamptz - (new_meeting_details ->> 'startsAt')::timestamptz)) / 60));
    insert into public.crm_notifications(firm_id, recipient_id, actor_id, task_id, task_title, kind, body)
    select current_task.firm_id, member.user_id, actor_id, current_task.id, current_task.title,
      'task_reminder', 'Cita confirmada. Consulta la fecha y hora en tu agenda.'
    from public.crm_firm_members member where member.firm_id = current_task.firm_id
      and member.status = 'active' and member.user_id::text = any(host_ids) and member.user_id <> actor_id;
  else
    new_meeting_details := new_meeting_details - array['confirmedAt', 'confirmedBy'];
    if next_status <> 'preparation' then
      new_meeting_details := new_meeting_details || jsonb_strip_nulls(jsonb_build_object(
        'confirmedAt', old_details -> 'confirmedAt', 'confirmedBy', old_details -> 'confirmedBy'));
    end if;
  end if;

  if closing then
    derived_titles := coalesce(new_meeting_details -> 'derivedTaskTitles', '[]'::jsonb);
    if jsonb_typeof(derived_titles) is distinct from 'array' then
      raise exception 'Las tareas derivadas deben ser una lista.';
    end if;
    if jsonb_array_length(derived_titles) > 25 or exists (
      select 1 from jsonb_array_elements(derived_titles) item(value)
      where jsonb_typeof(item.value) <> 'string' or length(trim(item.value #>> '{}')) not between 1 and 500
    ) then raise exception 'Añade como máximo 25 tareas derivadas de hasta 500 caracteres.'; end if;
    for derived_title in select distinct trim(value) from jsonb_array_elements_text(derived_titles) loop
      perform public.crm_create_task(current_task.firm_id, current_task.case_id,
        case when current_task.case_id is null then current_task.opportunity_id else null end,
        'task', derived_title, '', 'medium', null, null, actor_id,
        new_parent_task_id => current_task.id, new_workstream_id => current_task.workstream_id);
    end loop;
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
        'medium', null, null, follow_up_id,
        new_parent_task_id => current_task.id, new_workstream_id => current_task.workstream_id
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
  set meeting_details = new_meeting_details - 'derivedTaskTitles',
      status = case when closing then 'completed'::public.crm_task_status else current_task.status end,
      completed_at = case when closing then coalesce(current_task.completed_at, now()) else current_task.completed_at end,
      completion_result = case when closing then 'Cita celebrada.' else current_task.completion_result end,
      due_at = case when next_status in ('scheduled', 'in_progress', 'finished')
        then (new_meeting_details ->> 'startsAt')::timestamptz else null end,
      due_on = case when next_status in ('scheduled', 'in_progress', 'finished')
        then (new_meeting_details ->> 'startsAt')::timestamptz at time zone 'Europe/Madrid' else null end
  where id = current_task.id returning * into saved_task;

  insert into public.crm_task_events(firm_id, task_id, event_type, payload)
  values (saved_task.firm_id, saved_task.id, 'meeting_changed',
    jsonb_build_object('status', next_status, 'previousStatus', current_status));
  if closing and current_task.status <> 'completed' then
    insert into public.crm_task_events(firm_id, task_id, event_type, payload)
    values (saved_task.firm_id, saved_task.id, 'completed', jsonb_build_object('relevance', saved_task.relevance));
  end if;
  return saved_task;
end;
$$;

notify pgrst, 'reload schema';
