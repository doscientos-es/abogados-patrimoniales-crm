-- Archive opportunities without deleting their commercial or audit history.
alter table public.crm_opportunities
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete restrict,
  add column if not exists archive_reason text;

alter table public.crm_opportunities
  add constraint crm_opportunities_archive_state_check check (
    (archived_at is null and archived_by is null and archive_reason is null)
    or
    (archived_at is not null and archived_by is not null and nullif(trim(archive_reason), '') is not null)
  );

create index crm_opportunities_active_firm_idx
  on public.crm_opportunities(firm_id, updated_at desc)
  where archived_at is null;

create or replace function public.crm_prevent_archived_opportunity_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.archived_at is not null then
    raise exception 'Archived opportunities cannot be modified';
  end if;
  return new;
end;
$$;

create trigger crm_opportunities_prevent_archived_changes
before update on public.crm_opportunities
for each row execute function public.crm_prevent_archived_opportunity_changes();

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
  if nullif(trim(archive_reason), '') is null then raise exception 'Archive reason is required'; end if;
  if char_length(trim(archive_reason)) > 1000 then raise exception 'Archive reason is too long'; end if;

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
      archive_reason = trim(archive_reason)
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

revoke all on function public.crm_archive_opportunity(uuid, integer, text) from public, anon;
grant execute on function public.crm_archive_opportunity(uuid, integer, text) to authenticated;