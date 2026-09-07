-- Onboarding comercial: operaciones atómicas, trazabilidad y límites de tenant.
alter table public.crm_firms
  add column if not exists onboarding_sequence integer not null default 0
  check (onboarding_sequence >= 0);

alter table public.crm_onboardings
  add column if not exists next_action text not null default '',
  add column if not exists engagement_mode text not null default 'pending'
    check (engagement_mode in ('pending', 'in_person', 'video_call', 'phone_call')),
  add constraint crm_onboardings_quote_amount_check
    check (quote_amount is null or quote_amount >= 0);

create table public.crm_onboarding_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete restrict,
  onboarding_id uuid not null references public.crm_onboardings(id) on delete cascade,
  event_type text not null check (char_length(trim(event_type)) between 1 and 120),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  actor_id uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index crm_onboarding_events_onboarding_created_idx
  on public.crm_onboarding_events (onboarding_id, created_at desc);

create or replace function public.crm_validate_onboarding_firm()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.crm_contacts where id = new.contact_id and firm_id = new.firm_id) then
    raise exception 'Onboarding contact must belong to the same firm';
  end if;
  if new.opportunity_id is not null and not exists (
    select 1 from public.crm_opportunities where id = new.opportunity_id and firm_id = new.firm_id
  ) then raise exception 'Onboarding opportunity must belong to the same firm'; end if;
  if new.case_id is not null and not exists (
    select 1 from public.crm_cases where id = new.case_id and firm_id = new.firm_id
  ) then raise exception 'Onboarding case must belong to the same firm'; end if;
  if new.assigned_to is not null and not exists (
    select 1 from public.crm_firm_members
    where firm_id = new.firm_id and user_id = new.assigned_to and status = 'active'
  ) then raise exception 'Onboarding assignee must be an active member of the same firm'; end if;
  return new;
end;
$$;

create or replace function public.crm_log_onboarding_event()
returns trigger language plpgsql set search_path = public as $$
begin
  insert into public.crm_onboarding_events (firm_id, onboarding_id, event_type, payload)
  values (new.firm_id, new.id, case when tg_op = 'INSERT' then 'created' else 'updated' end,
    jsonb_build_object('phase', new.phase, 'version', new.version));
  return new;
end;
$$;

drop trigger if exists crm_onboardings_validate_firm on public.crm_onboardings;
create trigger crm_onboardings_validate_firm before insert or update on public.crm_onboardings
for each row execute function public.crm_validate_onboarding_firm();
create trigger crm_onboardings_log_insert after insert on public.crm_onboardings
for each row execute function public.crm_log_onboarding_event();
create trigger crm_onboardings_log_update after update on public.crm_onboardings
for each row execute function public.crm_log_onboarding_event();

alter table public.crm_onboarding_events enable row level security;
create policy crm_onboarding_events_read on public.crm_onboarding_events for select to authenticated
  using (public.crm_is_firm_member(firm_id));

drop policy if exists crm_onboardings_update on public.crm_onboardings;
revoke insert, update, delete on public.crm_onboardings, public.crm_onboarding_events from authenticated;
grant select on public.crm_onboardings, public.crm_onboarding_events to authenticated;

create or replace function public.crm_create_onboarding(
  target_firm_id uuid, target_contact_id uuid, target_opportunity_id uuid,
  new_matter_title text, new_quote_reference text, new_quote_amount numeric,
  new_assigned_to uuid, new_proforma_sent_on date, new_next_action text default ''
)
returns public.crm_onboardings language plpgsql security definer set search_path = public as $$
declare saved public.crm_onboardings; next_number integer;
begin
  if auth.uid() is null or not public.crm_is_firm_member(target_firm_id) then raise exception 'Forbidden'; end if;
  if nullif(trim(new_matter_title), '') is null or char_length(trim(new_matter_title)) > 300 then raise exception 'Matter title is required'; end if;
  if nullif(trim(new_quote_reference), '') is null or char_length(trim(new_quote_reference)) > 120 then raise exception 'Quote reference is required'; end if;
  if new_quote_amount is not null and new_quote_amount < 0 then raise exception 'Quote amount cannot be negative'; end if;
  if new_proforma_sent_on is null then raise exception 'Proforma sent date is required'; end if;
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

create or replace function public.crm_update_onboarding_action(
  target_onboarding_id uuid, target_expected_version integer, new_next_action text
)
returns public.crm_onboardings language plpgsql security definer set search_path = public as $$
declare current_record public.crm_onboardings; saved public.crm_onboardings;
begin
  select * into current_record from public.crm_onboardings where id = target_onboarding_id for update;
  if not found or not public.crm_is_firm_member(current_record.firm_id) then raise exception 'Onboarding not found'; end if;
  if current_record.version <> target_expected_version then raise exception 'Onboarding changed by another user; reload before saving' using errcode = '40001'; end if;
  if char_length(trim(coalesce(new_next_action, ''))) > 500 then raise exception 'Next action is too long'; end if;
  update public.crm_onboardings set next_action = trim(coalesce(new_next_action, '')) where id = current_record.id returning * into saved;
  return saved;
end;
$$;

create or replace function public.crm_transition_onboarding(
  target_onboarding_id uuid, target_expected_version integer, transition_action text,
  occurred_on date default null, scheduled_at timestamptz default null, new_engagement_mode text default null
)
returns public.crm_onboardings language plpgsql security definer set search_path = public as $$
declare current_record public.crm_onboardings; saved public.crm_onboardings; next_phase text;
begin
  select * into current_record from public.crm_onboardings where id = target_onboarding_id for update;
  if not found or not public.crm_is_firm_member(current_record.firm_id) then raise exception 'Onboarding not found'; end if;
  if current_record.version <> target_expected_version then raise exception 'Onboarding changed by another user; reload before advancing' using errcode = '40001'; end if;
  if transition_action = 'payment_confirmed' and current_record.phase = 'proforma' then
    next_phase := 'payment';
    update public.crm_onboardings set phase = next_phase, phase_changed_on = coalesce(occurred_on, current_date),
      payment_confirmed_on = coalesce(occurred_on, current_date), next_action = 'Programar inicio formal'
    where id = current_record.id returning * into saved;
  elsif transition_action = 'formal_start_scheduled' and current_record.phase = 'payment' then
    if scheduled_at is null then raise exception 'Formal start date and time are required'; end if;
    if new_engagement_mode not in ('in_person', 'video_call', 'phone_call') then raise exception 'A formal start modality is required'; end if;
    next_phase := 'formal_start';
    update public.crm_onboardings set phase = next_phase, phase_changed_on = scheduled_at::date,
      formal_start_scheduled_at = scheduled_at, engagement_mode = new_engagement_mode,
      next_action = 'Realizar y documentar el inicio formal'
    where id = current_record.id returning * into saved;
  elsif transition_action = 'formal_start_completed' and current_record.phase = 'formal_start' then
    next_phase := 'completed';
    update public.crm_onboardings set phase = next_phase, phase_changed_on = coalesce(occurred_on, current_date),
      formal_start_completed_at = coalesce(scheduled_at, now()), next_action = 'Abrir expediente'
    where id = current_record.id returning * into saved;
  else raise exception 'Invalid onboarding transition'; end if;
  insert into public.crm_onboarding_events (firm_id, onboarding_id, event_type, payload)
  values (saved.firm_id, saved.id, transition_action, jsonb_build_object('from', current_record.phase, 'to', next_phase));
  return saved;
end;
$$;

create or replace function public.crm_log_onboarding_communication(
  target_onboarding_id uuid, communication_type text, subject_or_summary text
)
returns void language plpgsql security definer set search_path = public as $$
declare current_record public.crm_onboardings;
begin
  select * into current_record from public.crm_onboardings where id = target_onboarding_id;
  if not found or not public.crm_is_firm_member(current_record.firm_id) then raise exception 'Onboarding not found'; end if;
  if communication_type not in ('email_draft', 'phone_call') then raise exception 'Invalid communication type'; end if;
  if nullif(trim(subject_or_summary), '') is null or char_length(trim(subject_or_summary)) > 2000 then raise exception 'A summary is required'; end if;
  insert into public.crm_onboarding_events (firm_id, onboarding_id, event_type, payload)
  values (current_record.firm_id, current_record.id, communication_type, jsonb_build_object('summary', trim(subject_or_summary)));
end;
$$;

create or replace function public.crm_open_onboarding_case(
  target_onboarding_id uuid, target_expected_version integer, new_title text, new_area text,
  new_matter_type text, new_nature text, new_priority public.crm_priority,
  new_assigned_to uuid, new_next_action text, new_current_position text
)
returns public.crm_cases language plpgsql security definer set search_path = public as $$
declare current_record public.crm_onboardings; saved_case public.crm_cases;
begin
  select * into current_record from public.crm_onboardings where id = target_onboarding_id for update;
  if not found or not public.crm_is_firm_member(current_record.firm_id) then raise exception 'Onboarding not found'; end if;
  if current_record.version <> target_expected_version then raise exception 'Onboarding changed by another user; reload before opening the case' using errcode = '40001'; end if;
  if current_record.phase <> 'completed' then raise exception 'The formal start must be completed first'; end if;
  if current_record.case_id is not null then raise exception 'A case is already linked to this onboarding'; end if;
  if nullif(trim(new_title), '') is null or new_nature not in ('judicial', 'extrajudicial') or new_priority is null then raise exception 'Case data is incomplete'; end if;
  insert into public.crm_cases (firm_id, primary_contact_id, opportunity_id, title, area, matter_type, nature, priority, assigned_to, next_action, current_position)
  values (current_record.firm_id, current_record.contact_id, current_record.opportunity_id, trim(new_title), trim(coalesce(new_area, '')),
    trim(coalesce(new_matter_type, '')), new_nature, new_priority, new_assigned_to,
    trim(coalesce(new_next_action, '')), trim(coalesce(new_current_position, '')))
  returning * into saved_case;
  update public.crm_onboardings set case_id = saved_case.id, next_action = 'Expediente abierto' where id = current_record.id;
  insert into public.crm_onboarding_events (firm_id, onboarding_id, event_type, payload)
  values (current_record.firm_id, current_record.id, 'case_opened', jsonb_build_object('case_id', saved_case.id));
  return saved_case;
end;
$$;

revoke all on function public.crm_create_onboarding(uuid, uuid, uuid, text, text, numeric, uuid, date, text) from public, anon;
revoke all on function public.crm_update_onboarding_action(uuid, integer, text) from public, anon;
revoke all on function public.crm_transition_onboarding(uuid, integer, text, date, timestamptz, text) from public, anon;
revoke all on function public.crm_log_onboarding_communication(uuid, text, text) from public, anon;
revoke all on function public.crm_open_onboarding_case(uuid, integer, text, text, text, text, public.crm_priority, uuid, text, text) from public, anon;
grant execute on function public.crm_create_onboarding(uuid, uuid, uuid, text, text, numeric, uuid, date, text) to authenticated;
grant execute on function public.crm_update_onboarding_action(uuid, integer, text) to authenticated;
grant execute on function public.crm_transition_onboarding(uuid, integer, text, date, timestamptz, text) to authenticated;
grant execute on function public.crm_log_onboarding_communication(uuid, text, text) to authenticated;
grant execute on function public.crm_open_onboarding_case(uuid, integer, text, text, text, text, public.crm_priority, uuid, text, text) to authenticated;