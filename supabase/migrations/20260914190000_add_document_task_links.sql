-- A document is evidence for work, rather than an implicit relation inferred
-- from the case. Links belong to the logical document and survive new versions.
create table public.crm_document_task_links (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  case_id uuid not null references public.crm_cases(id) on delete cascade,
  document_logical_id uuid not null references public.crm_case_documents(id) on delete restrict,
  task_id uuid not null references public.crm_tasks(id) on delete restrict,
  created_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (document_logical_id, task_id)
);

create index crm_document_task_links_firm_document_created_idx
  on public.crm_document_task_links(firm_id, document_logical_id, created_at desc);
create index crm_document_task_links_case_created_idx
  on public.crm_document_task_links(case_id, created_at desc);
create index crm_document_task_links_task_idx
  on public.crm_document_task_links(task_id);
create index crm_document_task_links_created_by_idx
  on public.crm_document_task_links(created_by) where created_by is not null;

alter table public.crm_document_task_links enable row level security;
create policy crm_document_task_links_read on public.crm_document_task_links
  for select to authenticated
  using (public.crm_can_access_case(case_id));
grant select on public.crm_document_task_links to authenticated;

alter table public.crm_case_document_events
  add column task_id uuid references public.crm_tasks(id) on delete restrict;
create index crm_case_document_events_task_idx
  on public.crm_case_document_events(task_id) where task_id is not null;
alter table public.crm_case_document_events
  drop constraint crm_case_document_events_event_type_check,
  add constraint crm_case_document_events_event_type_check
    check (event_type in (
      'archived', 'workflow_status_changed', 'task_linked', 'task_unlinked'
    ));

create or replace function public.crm_link_document_task(
  target_document_id uuid,
  target_task_id uuid
)
returns public.crm_document_task_links
language plpgsql
security definer
set search_path = public
as $$
declare
  current_document public.crm_case_documents;
  current_task public.crm_tasks;
  created_link public.crm_document_task_links;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into current_document
  from public.crm_case_documents
  where id = target_document_id and is_current and archived_at is null
  for share;
  if not found or not public.crm_can_read_case_document(current_document.storage_path) then
    raise exception 'Document not found';
  end if;

  select * into current_task from public.crm_tasks where id = target_task_id for share;
  if not found or current_task.firm_id <> current_document.firm_id
    or current_task.case_id is distinct from current_document.case_id
    or not public.crm_can_access_case(current_task.case_id) then
    raise exception 'Task must belong to the same case';
  end if;

  insert into public.crm_document_task_links(
    firm_id, case_id, document_logical_id, task_id, created_by
  ) values (
    current_document.firm_id, current_document.case_id,
    current_document.logical_document_id, current_task.id, auth.uid()
  )
  on conflict (document_logical_id, task_id) do nothing
  returning * into created_link;

  if created_link.id is null then
    select * into created_link from public.crm_document_task_links
    where document_logical_id = current_document.logical_document_id and task_id = current_task.id;
    return created_link;
  end if;

  insert into public.crm_case_document_events(
    firm_id, case_id, document_id, logical_document_id, task_id, event_type, actor_id
  ) values (
    current_document.firm_id, current_document.case_id, current_document.id,
    current_document.logical_document_id, current_task.id, 'task_linked', auth.uid()
  );
  return created_link;
end;
$$;

create or replace function public.crm_unlink_document_task(
  target_document_id uuid,
  target_task_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_document public.crm_case_documents;
  removed_link public.crm_document_task_links;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into current_document
  from public.crm_case_documents
  where id = target_document_id and is_current and archived_at is null
  for share;
  if not found or not public.crm_can_read_case_document(current_document.storage_path) then
    raise exception 'Document not found';
  end if;

  delete from public.crm_document_task_links
  where document_logical_id = current_document.logical_document_id
    and task_id = target_task_id
  returning * into removed_link;
  if not found or removed_link.firm_id <> current_document.firm_id
    or removed_link.case_id <> current_document.case_id then
    raise exception 'Document task link not found';
  end if;

  insert into public.crm_case_document_events(
    firm_id, case_id, document_id, logical_document_id, task_id, event_type, actor_id
  ) values (
    current_document.firm_id, current_document.case_id, current_document.id,
    current_document.logical_document_id, target_task_id, 'task_unlinked', auth.uid()
  );
end;
$$;

create or replace function public.crm_create_document_task(
  target_document_id uuid,
  new_kind text,
  new_title text,
  new_description text,
  new_priority public.crm_priority,
  new_due_at timestamptz,
  new_reminder_at timestamptz,
  new_deadline_class text,
  new_assigned_to uuid
)
returns public.crm_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  current_document public.crm_case_documents;
  created_task public.crm_tasks;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if new_kind not in ('task', 'reminder', 'event', 'deadline') then
    raise exception 'Invalid task kind';
  end if;
  if nullif(trim(new_title), '') is null or char_length(trim(new_title)) > 240 then
    raise exception 'Invalid task title';
  end if;
  if new_kind = 'deadline' and (new_due_at is null or new_deadline_class not in ('judicial', 'extrajudicial')) then
    raise exception 'A deadline requires a due date and class';
  end if;
  if new_kind <> 'deadline' and new_deadline_class is not null then
    raise exception 'Only deadlines can have a deadline class';
  end if;

  select * into current_document
  from public.crm_case_documents
  where id = target_document_id and is_current and archived_at is null
  for share;
  if not found or not public.crm_can_read_case_document(current_document.storage_path) then
    raise exception 'Document not found';
  end if;

  insert into public.crm_tasks(
    firm_id, case_id, kind, title, description, priority, due_at, due_on,
    reminder_at, deadline_class, validation_status, assigned_to
  ) values (
    current_document.firm_id, current_document.case_id, new_kind, trim(new_title),
    coalesce(new_description, ''), new_priority, new_due_at,
    new_due_at at time zone 'Europe/Madrid', new_reminder_at,
    new_deadline_class,
    case when new_kind = 'deadline' then 'proposed' else 'not_required' end,
    new_assigned_to
  ) returning * into created_task;

  perform public.crm_link_document_task(current_document.id, created_task.id);
  return created_task;
end;
$$;

revoke all on function public.crm_link_document_task(uuid, uuid) from public, anon;
grant execute on function public.crm_link_document_task(uuid, uuid) to authenticated;
revoke all on function public.crm_unlink_document_task(uuid, uuid) from public, anon;
grant execute on function public.crm_unlink_document_task(uuid, uuid) to authenticated;
revoke all on function public.crm_create_document_task(uuid, text, text, text, public.crm_priority, timestamptz, timestamptz, text, uuid) from public, anon;
grant execute on function public.crm_create_document_task(uuid, text, text, text, public.crm_priority, timestamptz, timestamptz, text, uuid) to authenticated;

notify pgrst, 'reload schema';