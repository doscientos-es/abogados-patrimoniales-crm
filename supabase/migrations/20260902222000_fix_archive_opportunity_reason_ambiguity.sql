-- Qualify the archive reason argument positionally to avoid a PL/pgSQL column ambiguity.
create or replace function public.crm_archive_opportunity(
  target_opportunity_id uuid,
  target_expected_version integer,
  archive_reason text
)
returns public.crm_opportunities
language plpgsql
security definer
set search_path = public
as $$
declare
  current_opportunity public.crm_opportunities;
  archived_opportunity public.crm_opportunities;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if target_expected_version is null or target_expected_version < 1 then
    raise exception 'A valid expected version is required';
  end if;
  if nullif(trim($3), '') is null then raise exception 'Archive reason is required'; end if;
  if char_length(trim($3)) > 1000 then raise exception 'Archive reason is too long'; end if;

  select * into current_opportunity
  from public.crm_opportunities
  where id = target_opportunity_id
  for update;

  if not found then raise exception 'Opportunity not found'; end if;
  if not public.crm_is_firm_member(current_opportunity.firm_id) then raise exception 'Forbidden'; end if;
  if current_opportunity.archived_at is not null then raise exception 'Opportunity already archived'; end if;
  if current_opportunity.version <> target_expected_version then
    raise exception 'Opportunity changed by another user; reload before archiving' using errcode = '40001';
  end if;

  update public.crm_opportunities
  set archived_at = now(),
      archived_by = auth.uid(),
      archive_reason = trim($3)
  where id = target_opportunity_id
  returning * into archived_opportunity;

  insert into public.crm_opportunity_events (firm_id, opportunity_id, event_type, payload)
  values (
    archived_opportunity.firm_id,
    archived_opportunity.id,
    'archived',
    jsonb_build_object('reason', archived_opportunity.archive_reason)
  );

  return archived_opportunity;
end;
$$;