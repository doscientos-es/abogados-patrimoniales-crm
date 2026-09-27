-- Persist the manual Kanban position and provide audited, permission-checked
-- note lifecycle actions without granting direct access to the append-only log.
alter table public.crm_tasks
  add column if not exists board_position integer;

create or replace function public.crm_set_task_board_order(
  target_firm_id uuid,
  target_status text,
  ordered_task_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  expected_status text;
  target_id uuid;
  position integer := 0;
begin
  if coalesce(cardinality(ordered_task_ids), 0) <> (select count(distinct submitted.task_id) from unnest(coalesce(ordered_task_ids, '{}'::uuid[])) as submitted(task_id)) then
    raise exception 'Task ordering cannot contain duplicate IDs';
  end if;
  if actor is null or not public.crm_is_firm_member(target_firm_id) then
    raise exception 'You are not an active member of this firm';
  end if;
  if target_status not in ('pending', 'in_progress') then
    raise exception 'Unsupported task board status';
  end if;
  if cardinality(ordered_task_ids) = 0 then
    return;
  end if;
  expected_status := target_status;
  update public.crm_tasks task set board_position = null
    where task.firm_id = target_firm_id and task.status = expected_status;
  for target_id in
    select current_task.id
    from public.crm_tasks current_task
    where current_task.firm_id = target_firm_id
      and current_task.status = expected_status
      and not (current_task.id = any(ordered_task_ids))
    order by current_task.board_position nulls last, current_task.due_at nulls last, current_task.title, current_task.id
    for update
  loop
    position := position + 1;
    update public.crm_tasks set board_position = position where id = target_id;
  end loop;
  if exists (
    select 1 from unnest(ordered_task_ids) as submitted(task_id)
    left join public.crm_tasks task on task.id = submitted.task_id and task.firm_id = target_firm_id
    where task.id is null or task.status <> expected_status
      or not (task.created_by = actor or task.assigned_to = actor or public.crm_has_firm_role(target_firm_id, array['owner','admin','lawyer']::public.crm_member_role[]))
  ) then
    raise exception 'A task is unavailable or cannot be reordered';
  end if;
  for target_id in select submitted.task_id from unnest(ordered_task_ids) with ordinality as submitted(task_id, ordinal) order by submitted.ordinal loop
    position := position + 1;
    update public.crm_tasks
      set board_position = position
      where firm_id = target_firm_id
        and id = target_id
        and status = expected_status
        and (created_by = actor or assigned_to = actor or public.crm_has_firm_role(target_firm_id, array['owner','admin','lawyer']::public.crm_member_role[]));
  end loop;
end;
$$;

revoke all on function public.crm_set_task_board_order(uuid, text, uuid[]) from public, anon;
grant execute on function public.crm_set_task_board_order(uuid, text, uuid[]) to authenticated;

create or replace function public.crm_update_note_state(
  target_note_id uuid,
  new_status text default null,
  new_highlighted boolean default null,
  new_critical boolean default null,
  new_requires_acknowledgement boolean default null,
  new_review_pending boolean default null,
  new_review_on date default null,
  new_expires_on date default null,
  new_snoozed_until date default null,
  conversion jsonb default null,
  event_type text default null,
  event_detail text default null
)
returns public.crm_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.crm_notes;
  actor uuid := auth.uid();
begin
  select * into saved from public.crm_notes where id = target_note_id for update;
  if not found or actor is null or not public.crm_is_firm_member(saved.firm_id) then
    raise exception 'Note not found or access denied';
  end if;
  if saved.visibility = 'restricted' and saved.created_by <> actor
    and not exists (select 1 from public.crm_note_permissions p where p.note_id = saved.id and p.user_id = actor) then
    raise exception 'You are not authorized to access this note';
  end if;
  if (event_type in ('updated','edited') or event_type like 'validity_%')
    and saved.created_by <> actor
    and not public.crm_has_firm_role(saved.firm_id, array['owner','admin']::public.crm_member_role[]) then
    raise exception 'Only the note author or a firm administrator can edit this note';
  end if;
  if new_status is not null and new_status not in ('active', 'resolved', 'archived') then
    raise exception 'Unsupported note status';
  end if;
  if conversion is not null and (
    jsonb_typeof(conversion) <> 'object'
    or conversion->>'tipo' not in ('tarea', 'actividad', 'actuacion', 'alerta')
    or coalesce(conversion->>'referenciaId', '') = ''
    or coalesce(conversion->>'etiqueta', '') = ''
  ) then
    raise exception 'Invalid note conversion';
  end if;

  update public.crm_notes set
    status = coalesce(new_status, status),
    highlighted = coalesce(new_highlighted, highlighted),
    critical = coalesce(new_critical, critical),
    requires_acknowledgement = coalesce(new_requires_acknowledgement, requires_acknowledgement),
    review_pending = coalesce(new_review_pending, review_pending),
    review_on = case when new_review_pending is not null or new_review_on is not null then new_review_on else review_on end,
    expires_on = case when new_expires_on is not null or (new_status = 'active' and saved.validity = 'permanent') then new_expires_on else expires_on end,
    snoozed_until = case when new_snoozed_until is not null or new_review_pending is not null then new_snoozed_until else snoozed_until end,
    details = case when conversion is null then details else jsonb_set(
      details,
      '{conversions}',
      coalesce(details->'conversions', '[]'::jsonb) || jsonb_build_array(conversion),
      true
    ) end,
    updated_by = actor,
    resolved_by = case when new_status = 'resolved' then actor when new_status = 'active' then null else resolved_by end,
    resolved_at = case when new_status = 'resolved' then now() when new_status = 'active' then null else resolved_at end,
    archived_by = case when new_status = 'archived' then actor when new_status = 'active' then null else archived_by end,
    archived_at = case when new_status = 'archived' then now() when new_status = 'active' then null else archived_at end
  where id = saved.id returning * into saved;

  if event_type is not null then
    insert into public.crm_note_events(note_id, firm_id, event_type, detail)
      values (saved.id, saved.firm_id, event_type, event_detail);
  end if;
  return saved;
end;
$$;

revoke all on function public.crm_update_note_state(uuid, text, boolean, boolean, boolean, boolean, date, date, date, jsonb, text, text) from public, anon;
grant execute on function public.crm_update_note_state(uuid, text, boolean, boolean, boolean, boolean, date, date, date, jsonb, text, text) to authenticated;

create or replace function public.crm_convert_note_to_task(
  target_note_id uuid,
  new_title text,
  new_description text,
  new_due_at timestamptz,
  new_priority public.crm_priority,
  new_critical boolean
)
returns public.crm_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  note public.crm_notes;
  task public.crm_tasks;
  actor uuid := auth.uid();
begin
  select * into note from public.crm_notes where id = target_note_id for update;
  if not found or actor is null or not public.crm_is_firm_member(note.firm_id) then
    raise exception 'Note not found or access denied';
  end if;
  if note.visibility = 'restricted' and note.created_by <> actor
    and not exists (select 1 from public.crm_note_permissions p where p.note_id = note.id and p.user_id = actor) then
    raise exception 'You are not authorized to access this note';
  end if;
  if note.case_id is null and note.opportunity_id is null then
    raise exception 'The note must be linked to a case or opportunity to create a task';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(note.details->'conversions', '[]'::jsonb)) item where item->>'tipo' = 'tarea') then
    raise exception 'This note already has a task conversion';
  end if;
  task := public.crm_create_task(
    note.firm_id, note.case_id, note.opportunity_id, 'task', new_title, new_description,
    coalesce(new_priority, 'medium'), new_due_at, null, actor, null,
    'Creada desde la nota interna ' || note.id::text, null, '{}'::jsonb, null, new_critical
  );
  update public.crm_notes set
    details = jsonb_set(
      details,
      '{conversions}',
      coalesce(details->'conversions', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'tipo', 'tarea', 'referenciaId', task.id, 'etiqueta', task.title,
        'fecha', now(), 'usuario', actor
      )),
      true
    ),
    updated_by = actor
  where id = note.id;
  insert into public.crm_note_events(note_id, firm_id, event_type, detail)
    values (note.id, note.firm_id, 'converted_to_task', 'Tarea persistente creada: ' || task.title || ' (' || task.id::text || ').');
  return task;
end;
$$;
revoke all on function public.crm_convert_note_to_task(uuid, text, text, timestamptz, public.crm_priority, boolean) from public, anon;
grant execute on function public.crm_convert_note_to_task(uuid, text, text, timestamptz, public.crm_priority, boolean) to authenticated;

drop policy if exists crm_note_permissions_read on public.crm_note_permissions;
create policy crm_note_permissions_read on public.crm_note_permissions
for select to authenticated using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.crm_notes note
    where note.id = note_id and public.crm_is_firm_member(note.firm_id)
      and (note.created_by = (select auth.uid())
        or public.crm_has_firm_role(note.firm_id, array['owner','admin']::public.crm_member_role[]))
  )
);

drop policy if exists crm_note_acknowledgements_read on public.crm_note_acknowledgements;
create policy crm_note_acknowledgements_read on public.crm_note_acknowledgements
for select to authenticated using (
  exists (
    select 1 from public.crm_notes note
    where note.id = note_id and public.crm_is_firm_member(note.firm_id)
      and (note.visibility = 'team' or note.created_by = (select auth.uid())
        or exists (select 1 from public.crm_note_permissions permission
          where permission.note_id = note.id and permission.user_id = (select auth.uid())))
  )
);

create or replace function public.crm_acknowledge_note(target_note_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.crm_notes;
  actor uuid := auth.uid();
begin
  select * into target from public.crm_notes where id = target_note_id;
  if not found or actor is null or not public.crm_is_firm_member(target.firm_id) then
    raise exception 'Note not found or access denied';
  end if;
  if target.visibility = 'restricted' and target.created_by <> actor
    and not exists (select 1 from public.crm_note_permissions p where p.note_id = target.id and p.user_id = actor) then
    raise exception 'You are not authorized to access this note';
  end if;
  insert into public.crm_note_acknowledgements(note_id, user_id)
    values (target.id, actor) on conflict (note_id, user_id) do nothing;
end;
$$;
revoke all on function public.crm_acknowledge_note(uuid) from public, anon;
grant execute on function public.crm_acknowledge_note(uuid) to authenticated;

drop policy if exists crm_note_events_read on public.crm_note_events;
create policy crm_note_events_read on public.crm_note_events
  for select to authenticated using (
    public.crm_is_firm_member(firm_id) and exists (
      select 1 from public.crm_notes n where n.id = note_id
        and (n.visibility = 'team' or n.created_by = (select auth.uid()) or exists (
          select 1 from public.crm_note_permissions p where p.note_id = n.id and p.user_id = (select auth.uid())
        ))
    )
  );

notify pgrst, 'reload schema';
