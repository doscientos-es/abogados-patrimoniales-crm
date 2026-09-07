-- Complete the lead workspace without exposing direct mutable access to its audit trail.
create unique index if not exists crm_onboardings_opportunity_unique_idx
  on public.crm_onboardings (opportunity_id)
  where opportunity_id is not null;

create or replace function public.crm_update_opportunity_details(
  target_opportunity_id uuid,
  target_expected_version integer,
  new_details jsonb
)
returns public.crm_opportunities
language plpgsql
security definer
set search_path = public
as $$
declare
  current_opportunity public.crm_opportunities;
  saved_opportunity public.crm_opportunities;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if target_expected_version is null or target_expected_version < 1 then
    raise exception 'A valid expected version is required';
  end if;
  if jsonb_typeof(new_details) <> 'object' or octet_length(new_details::text) > 50000 then
    raise exception 'Opportunity details must be an object no larger than 50 KB';
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
  if current_opportunity.details = new_details then return current_opportunity; end if;

  update public.crm_opportunities
  set details = new_details
  where id = current_opportunity.id
  returning * into saved_opportunity;

  insert into public.crm_opportunity_events (firm_id, opportunity_id, event_type, payload)
  values (
    saved_opportunity.firm_id,
    saved_opportunity.id,
    'qualification_updated',
    jsonb_build_object('previous_version', current_opportunity.version)
  );
  return saved_opportunity;
end;
$$;

create or replace function public.crm_log_opportunity_communication(
  target_opportunity_id uuid,
  communication_type text,
  subject_or_summary text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_opportunity public.crm_opportunities;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if communication_type not in ('email_draft', 'phone_call', 'meeting') then
    raise exception 'Invalid communication type';
  end if;
  if nullif(trim(subject_or_summary), '') is null or char_length(trim(subject_or_summary)) > 2000 then
    raise exception 'A communication summary is required';
  end if;
  select * into current_opportunity from public.crm_opportunities where id = target_opportunity_id;
  if not found then raise exception 'Opportunity not found'; end if;
  if not public.crm_is_firm_member(current_opportunity.firm_id) then raise exception 'Forbidden'; end if;

  insert into public.crm_opportunity_events (firm_id, opportunity_id, event_type, payload)
  values (
    current_opportunity.firm_id,
    current_opportunity.id,
    'communication_logged',
    jsonb_build_object('type', communication_type, 'summary', trim(subject_or_summary))
  );
end;
$$;

create or replace function public.crm_create_onboarding(
  target_firm_id uuid, target_contact_id uuid, target_opportunity_id uuid,
  new_matter_title text, new_quote_reference text, new_quote_amount numeric,
  new_assigned_to uuid, new_proforma_sent_on date, new_next_action text default ''
)
returns public.crm_onboardings language plpgsql security definer set search_path = public as $$
declare saved public.crm_onboardings; next_number integer; lead public.crm_opportunities;
begin
  if auth.uid() is null or not public.crm_is_firm_member(target_firm_id) then raise exception 'Forbidden'; end if;
  if nullif(trim(new_matter_title), '') is null or char_length(trim(new_matter_title)) > 300 then raise exception 'Matter title is required'; end if;
  if nullif(trim(new_quote_reference), '') is null or char_length(trim(new_quote_reference)) > 120 then raise exception 'Quote reference is required'; end if;
  if new_quote_amount is not null and new_quote_amount < 0 then raise exception 'Quote amount cannot be negative'; end if;
  if new_proforma_sent_on is null then raise exception 'Proforma sent date is required'; end if;

  select * into lead from public.crm_opportunities where id = target_opportunity_id for update;
  if not found or lead.firm_id <> target_firm_id or lead.contact_id <> target_contact_id then raise exception 'Lead not found'; end if;
  if lead.stage <> 'won' then raise exception 'Only accepted leads can start onboarding'; end if;
  if exists (select 1 from public.crm_onboardings where opportunity_id = lead.id) then raise exception 'This lead already has onboarding'; end if;

  update public.crm_firms set onboarding_sequence = onboarding_sequence + 1 where id = target_firm_id
  returning onboarding_sequence into next_number;
  insert into public.crm_onboardings (
    firm_id, contact_id, opportunity_id, reference, matter_title, phase, phase_changed_on,
    quote_reference, quote_amount, proforma_sent_on, assigned_to, next_action
  ) values (
    target_firm_id, target_contact_id, target_opportunity_id,
    'ONB-' || extract(year from current_date)::text || '-' || lpad(next_number::text, 5, '0'),
    trim(new_matter_title), 'proforma', new_proforma_sent_on, trim(new_quote_reference),
    new_quote_amount, new_proforma_sent_on, new_assigned_to, trim(coalesce(new_next_action, ''))
  ) returning * into saved;
  return saved;
end;
$$;

revoke all on function public.crm_update_opportunity_details(uuid, integer, jsonb) from public, anon;
revoke all on function public.crm_log_opportunity_communication(uuid, text, text) from public, anon;
revoke all on function public.crm_create_onboarding(uuid, uuid, uuid, text, text, numeric, uuid, date, text) from public, anon;
grant execute on function public.crm_update_opportunity_details(uuid, integer, jsonb) to authenticated;
grant execute on function public.crm_log_opportunity_communication(uuid, text, text) to authenticated;
grant execute on function public.crm_create_onboarding(uuid, uuid, uuid, text, text, numeric, uuid, date, text) to authenticated;