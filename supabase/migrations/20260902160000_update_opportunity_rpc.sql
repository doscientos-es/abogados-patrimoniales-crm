-- Edit opportunities through a tenant-safe RPC with optimistic concurrency and audit history.
create or replace function public.crm_update_opportunity(
  target_opportunity_id uuid,
  target_expected_version integer,
  new_title text,
  new_area text,
  new_priority public.crm_priority,
  new_operational_status text,
  new_source text,
  new_description text,
  new_assigned_to uuid,
  new_estimated_amount numeric
)
returns public.crm_opportunities
language plpgsql
security definer
set search_path = public
as $$
declare
  current_opportunity public.crm_opportunities;
  updated_opportunity public.crm_opportunities;
  changed_fields text[];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if target_expected_version is null or target_expected_version < 1 then
    raise exception 'A valid expected version is required';
  end if;
  if nullif(trim(new_title), '') is null then raise exception 'Title is required'; end if;
  if char_length(trim(new_title)) > 300 then raise exception 'Title is too long'; end if;
  if char_length(trim(coalesce(new_area, ''))) > 160 then raise exception 'Area is too long'; end if;
  if new_priority is null then raise exception 'Priority is required'; end if;
  if nullif(trim(new_operational_status), '') is null then
    raise exception 'Operational status is required';
  end if;
  if char_length(trim(new_operational_status)) > 160 then
    raise exception 'Operational status is too long';
  end if;
  if char_length(trim(coalesce(new_source, ''))) > 160 then raise exception 'Source is too long'; end if;
  if char_length(coalesce(new_description, '')) > 20000 then raise exception 'Description is too long'; end if;
  if new_estimated_amount is not null and new_estimated_amount < 0 then
    raise exception 'Estimated amount cannot be negative';
  end if;

  select * into current_opportunity
  from public.crm_opportunities
  where id = target_opportunity_id
  for update;

  if not found then raise exception 'Opportunity not found'; end if;
  if not public.crm_is_firm_member(current_opportunity.firm_id) then raise exception 'Forbidden'; end if;
  if current_opportunity.version <> target_expected_version then
    raise exception 'Opportunity changed by another user; reload before saving' using errcode = '40001';
  end if;
  if new_assigned_to is not null and not exists (
    select 1 from public.crm_firm_members
    where firm_id = current_opportunity.firm_id
      and user_id = new_assigned_to
      and status = 'active'
  ) then
    raise exception 'Opportunity assignee must be an active member of the same firm';
  end if;

  changed_fields := array_remove(array[
    case when current_opportunity.title is distinct from trim(new_title) then 'title' end,
    case when current_opportunity.area is distinct from trim(coalesce(new_area, '')) then 'area' end,
    case when current_opportunity.priority is distinct from new_priority then 'priority' end,
    case when current_opportunity.operational_status is distinct from trim(new_operational_status) then 'operational_status' end,
    case when current_opportunity.source is distinct from trim(coalesce(new_source, '')) then 'source' end,
    case when current_opportunity.description is distinct from coalesce(new_description, '') then 'description' end,
    case when current_opportunity.assigned_to is distinct from new_assigned_to then 'assigned_to' end,
    case when current_opportunity.estimated_amount is distinct from new_estimated_amount then 'estimated_amount' end
  ], null);

  if cardinality(changed_fields) = 0 then return current_opportunity; end if;

  update public.crm_opportunities
  set title = trim(new_title),
      area = trim(coalesce(new_area, '')),
      priority = new_priority,
      operational_status = trim(new_operational_status),
      source = trim(coalesce(new_source, '')),
      description = coalesce(new_description, ''),
      assigned_to = new_assigned_to,
      estimated_amount = new_estimated_amount
  where id = target_opportunity_id
  returning * into updated_opportunity;

  insert into public.crm_opportunity_events (firm_id, opportunity_id, event_type, payload)
  values (
    updated_opportunity.firm_id,
    updated_opportunity.id,
    'updated',
    jsonb_build_object('previous_version', current_opportunity.version, 'fields', to_jsonb(changed_fields))
  );

  return updated_opportunity;
end;
$$;

revoke all on function public.crm_update_opportunity(uuid, integer, text, text, public.crm_priority, text, text, text, uuid, numeric) from public, anon;
grant execute on function public.crm_update_opportunity(uuid, integer, text, text, public.crm_priority, text, text, text, uuid, numeric) to authenticated;
