create or replace function public.crm_update_case(
  target_case_id uuid,
  target_expected_version integer,
  new_title text,
  new_area text,
  new_matter_type text,
  new_nature text,
  new_general_status text,
  new_phase text,
  new_operational_status text,
  new_priority public.crm_priority,
  new_assigned_to uuid,
  new_opened_on date,
  new_closed_on date,
  new_next_action text,
  new_current_position text
)
returns public.crm_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  current_case public.crm_cases;
  updated_case public.crm_cases;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if target_expected_version is null or target_expected_version < 1 then
    raise exception 'A valid expected version is required';
  end if;
  if nullif(trim(new_title), '') is null or char_length(trim(new_title)) > 300 then
    raise exception 'A valid title is required';
  end if;
  if new_nature is null then raise exception 'Invalid case nature'; end if;
  if new_priority is null then raise exception 'Priority is required'; end if;
  if nullif(trim(new_general_status), '') is null then raise exception 'General status is required'; end if;
  if nullif(trim(new_phase), '') is null then raise exception 'Phase is required'; end if;
  if nullif(trim(new_operational_status), '') is null then raise exception 'Operational status is required'; end if;
  if new_closed_on is not null and new_closed_on < new_opened_on then
    raise exception 'Closing date cannot precede opening date';
  end if;

  select * into current_case from public.crm_cases where id = target_case_id for update;
  if not found then raise exception 'Case not found'; end if;
  if not public.crm_is_firm_member(current_case.firm_id) then raise exception 'Forbidden'; end if;
  if current_case.version <> target_expected_version then
    raise exception 'Case changed by another user; reload before saving' using errcode = '40001';
  end if;
  if new_assigned_to is not null and not exists (
    select 1 from public.crm_firm_members
    where firm_id = current_case.firm_id and user_id = new_assigned_to and status = 'active'
  ) then
    raise exception 'Case assignee must be an active member of the same firm';
  end if;

  update public.crm_cases set
    title = trim(new_title), area = trim(coalesce(new_area, '')),
    matter_type = trim(coalesce(new_matter_type, '')), nature = new_nature,
    general_status = trim(new_general_status), phase = trim(new_phase),
    operational_status = trim(new_operational_status), priority = new_priority,
    assigned_to = new_assigned_to, opened_on = new_opened_on, closed_on = new_closed_on,
    next_action = trim(coalesce(new_next_action, '')),
    current_position = trim(coalesce(new_current_position, ''))
  where id = target_case_id returning * into updated_case;
  return updated_case;
end;
$$;

revoke all on function public.crm_update_case(uuid, integer, text, text, text, text, text, text, text, public.crm_priority, uuid, date, date, text, text) from public, anon;
grant execute on function public.crm_update_case(uuid, integer, text, text, text, text, text, text, text, public.crm_priority, uuid, date, date, text, text) to authenticated;

drop policy if exists crm_cases_update on public.crm_cases;
