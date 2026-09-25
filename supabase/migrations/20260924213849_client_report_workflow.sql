create or replace function public.crm_register_client_report(
  target_case_id uuid,
  target_contact_id uuid,
  report_subject text,
  report_content text,
  report_channel text,
  report_occurred_at timestamptz,
  reported_activities jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  selected record;
  changed_count integer;
  new_communication_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.crm_can_access_case(target_case_id) then raise exception 'Forbidden'; end if;
  if not exists (
    select 1 from public.crm_cases c
    join public.crm_contacts p on p.firm_id = c.firm_id and p.id = target_contact_id
    where c.id = target_case_id and p.status = 'active'
  ) then raise exception 'The selected contact is not active in this firm'; end if;
  if nullif(trim(report_content), '') is null or char_length(report_content) > 10000 then
    raise exception 'Report content is required and must be at most 10000 characters';
  end if;
  if char_length(coalesce(report_subject, '')) > 300 then raise exception 'Invalid report subject'; end if;
  if report_channel not in ('email', 'phone', 'whatsapp', 'in_person', 'video') then
    raise exception 'Invalid report channel';
  end if;
  if jsonb_typeof(reported_activities) <> 'array' then raise exception 'Reported activities must be an array'; end if;

  if exists (
    select 1 from jsonb_to_recordset(reported_activities) as item(id uuid, version integer)
    where item.id is null or item.version is null or item.version < 1
  ) then raise exception 'Every reported activity requires a valid id and version'; end if;
  if exists (
    select 1 from jsonb_to_recordset(reported_activities) as item(id uuid, version integer)
    group by id having count(*) > 1
  ) then raise exception 'Duplicate activities are not allowed'; end if;

  for selected in
    select item.id, item.version
    from jsonb_to_recordset(reported_activities) as item(id uuid, version integer)
    order by item.id
  loop
    update public.crm_case_activities
    set client_informed = true
    where id = selected.id
      and case_id = target_case_id
      and version = selected.version
      and client_visible = true
      and client_informed = false;
    get diagnostics changed_count = row_count;
    if changed_count <> 1 then
      raise exception 'An activity changed or was already reported; reload before continuing' using errcode = '40001';
    end if;
  end loop;

  insert into public.crm_case_communications (
    firm_id, case_id, contact_id, direction, communication_type, channel,
    subject, content, occurred_at
  )
  select c.firm_id, c.id, target_contact_id, 'outbound', 'client_report', report_channel,
    coalesce(nullif(trim(report_subject), ''), 'Reporte de situación del expediente'),
    trim(report_content), coalesce(report_occurred_at, now())
  from public.crm_cases c
  where c.id = target_case_id
  returning id into new_communication_id;

  if new_communication_id is null then raise exception 'Could not register the client report'; end if;
  return new_communication_id;
end;
$$;

revoke all on function public.crm_register_client_report(uuid, uuid, text, text, text, timestamptz, jsonb) from public, anon;
grant execute on function public.crm_register_client_report(uuid, uuid, text, text, text, timestamptz, jsonb) to authenticated;
