create or replace function public.crm_update_case_workstream(
  target_workstream_id uuid,
  target_expected_version integer,
  new_parent_id uuid,
  new_title text,
  new_work_type text,
  new_description text,
  new_status text,
  new_priority public.crm_priority,
  new_assigned_to uuid,
  new_starts_on date,
  new_target_on date,
  new_resolved_on date,
  new_closed_on date,
  new_details jsonb
)
returns public.crm_case_workstreams
language plpgsql
security definer
set search_path = public
as $$
declare
  current_workstream public.crm_case_workstreams;
  updated_workstream public.crm_case_workstreams;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if target_expected_version is null or target_expected_version < 1 then
    raise exception 'A valid expected version is required';
  end if;
  if nullif(trim(new_title), '') is null or char_length(trim(new_title)) > 300 then
    raise exception 'A valid title is required';
  end if;
  if new_status is null or new_status not in ('pending', 'in_analysis', 'in_progress', 'on_hold', 'resolved', 'closed', 'discarded') then
    raise exception 'Invalid workstream status';
  end if;
  if new_details is null or jsonb_typeof(new_details) <> 'object' then
    raise exception 'Workstream details must be an object';
  end if;
  if jsonb_typeof(coalesce(new_details -> 'colaboradores', '[]'::jsonb)) <> 'array' then
    raise exception 'Workstream collaborators must be an array';
  end if;
  if new_resolved_on is not null and new_starts_on is not null and new_resolved_on < new_starts_on then
    raise exception 'Resolution date cannot precede opening date';
  end if;
  if new_closed_on is not null and new_starts_on is not null and new_closed_on < new_starts_on then
    raise exception 'Closing date cannot precede opening date';
  end if;

  select * into current_workstream
  from public.crm_case_workstreams
  where id = target_workstream_id
  for update;
  if not found then raise exception 'Workstream not found'; end if;
  if not public.crm_is_firm_member(current_workstream.firm_id) then raise exception 'Forbidden'; end if;
  if current_workstream.version <> target_expected_version then
    raise exception 'Workstream changed by another user; reload before saving' using errcode = '40001';
  end if;
  if new_parent_id is not null and not exists (
    select 1 from public.crm_case_workstreams parent
    where parent.id = new_parent_id and parent.firm_id = current_workstream.firm_id
      and parent.case_id = current_workstream.case_id and parent.parent_id is null
      and parent.id <> current_workstream.id
  ) then
    raise exception 'Parent must be another root workstream in the same case';
  end if;
  if new_parent_id is not null and exists (
    select 1 from public.crm_case_workstreams child
    where child.parent_id = current_workstream.id
  ) then
    raise exception 'A workstream with sub-workstreams must remain a root';
  end if;
  if new_assigned_to is not null and not exists (
    select 1 from public.crm_firm_members
    where firm_id = current_workstream.firm_id and user_id = new_assigned_to and status = 'active'
  ) then
    raise exception 'Workstream assignee must be an active member of the same firm';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(new_details -> 'colaboradores', '[]'::jsonb)) collaborator(id)
    where not exists (
      select 1 from public.crm_firm_members member
      where member.firm_id = current_workstream.firm_id
        and member.user_id::text = collaborator.id and member.status = 'active'
    )
  ) then
    raise exception 'Workstream collaborators must be active members of the same firm';
  end if;

  update public.crm_case_workstreams set
    parent_id = new_parent_id,
    title = trim(new_title),
    work_type = trim(coalesce(new_work_type, '')),
    description = trim(coalesce(new_description, '')),
    status = new_status,
    priority = new_priority,
    assigned_to = new_assigned_to,
    starts_on = new_starts_on,
    target_on = new_target_on,
    resolved_on = new_resolved_on,
    closed_on = new_closed_on,
    details = new_details
  where id = target_workstream_id
  returning * into updated_workstream;
  return updated_workstream;
end;
$$;

revoke all on function public.crm_update_case_workstream(uuid, integer, uuid, text, text, text, text, public.crm_priority, uuid, date, date, date, date, jsonb) from public, anon;
grant execute on function public.crm_update_case_workstream(uuid, integer, uuid, text, text, text, text, public.crm_priority, uuid, date, date, date, date, jsonb) to authenticated;