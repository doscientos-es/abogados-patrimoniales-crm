-- Operational casework: relational entities with firm-scoped foreign keys.
alter table public.crm_firms add column if not exists case_sequence integer not null default 0 check (case_sequence >= 0);
alter table public.crm_contacts add constraint crm_contacts_firm_id_id_key unique (firm_id, id);
alter table public.crm_opportunities add constraint crm_opportunities_firm_id_id_key unique (firm_id, id);

create table public.crm_cases (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.crm_firms(id) on delete restrict,
  case_number integer not null, reference text generated always as ('AP_' || case_number) stored,
  primary_contact_id uuid not null, opportunity_id uuid, title text not null check (char_length(trim(title)) between 1 and 300),
  area text not null default '', matter_type text not null default '', nature text not null check (nature in ('judicial', 'extrajudicial')),
  general_status text not null default 'active', phase text not null default 'intake', operational_status text not null default 'pending',
  priority public.crm_priority not null default 'medium', assigned_to uuid references public.crm_profiles(id) on delete set null,
  opened_on date not null default current_date, closed_on date, next_action text not null default '', current_position text not null default '',
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'), version integer not null default 1 check (version > 0),
  created_by uuid references public.crm_profiles(id) on delete set null, updated_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (firm_id, case_number), unique (firm_id, id), foreign key (firm_id, primary_contact_id) references public.crm_contacts(firm_id, id) on delete restrict,
  foreign key (firm_id, opportunity_id) references public.crm_opportunities(firm_id, id) on delete set null,
  check (closed_on is null or closed_on >= opened_on)
);

create table public.crm_case_contacts (
  case_id uuid not null, firm_id uuid not null, contact_id uuid not null, role text not null check (char_length(trim(role)) between 1 and 120),
  is_client boolean not null default false, details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(), primary key (case_id, contact_id),
  foreign key (firm_id, case_id) references public.crm_cases(firm_id, id) on delete cascade,
  foreign key (firm_id, contact_id) references public.crm_contacts(firm_id, id) on delete restrict
);

create table public.crm_case_workstreams (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null, case_id uuid not null, parent_id uuid,
  title text not null check (char_length(trim(title)) between 1 and 300), work_type text not null default '', description text not null default '',
  status text not null default 'pending', priority public.crm_priority not null default 'medium', assigned_to uuid references public.crm_profiles(id) on delete set null,
  starts_on date, target_on date, resolved_on date, closed_on date, sort_order integer not null default 0,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'), version integer not null default 1 check (version > 0),
  created_by uuid references public.crm_profiles(id) on delete set null, updated_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (firm_id, case_id, id),
  foreign key (firm_id, case_id) references public.crm_cases(firm_id, id) on delete cascade,
  foreign key (firm_id, case_id, parent_id) references public.crm_case_workstreams(firm_id, case_id, id) on delete set null,
  check (parent_id is null or parent_id <> id)
);

create table public.crm_case_activities (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null, case_id uuid not null, workstream_id uuid,
  activity_type text not null check (char_length(trim(activity_type)) between 1 and 120), title text not null check (char_length(trim(title)) between 1 and 300),
  description text not null default '', occurred_at timestamptz not null default now(), assigned_to uuid references public.crm_profiles(id) on delete set null,
  status text not null default 'pending', result text not null default '', next_action text not null default '', time_spent_hours numeric(8,2) not null default 0 check (time_spent_hours >= 0),
  billable boolean not null default false, client_visible boolean not null default false, client_informed boolean not null default false,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'), version integer not null default 1 check (version > 0),
  created_by uuid references public.crm_profiles(id) on delete set null, updated_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (firm_id, case_id, id),
  foreign key (firm_id, case_id) references public.crm_cases(firm_id, id) on delete cascade,
  foreign key (firm_id, case_id, workstream_id) references public.crm_case_workstreams(firm_id, case_id, id) on delete set null
);

create table public.crm_case_documents (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null, case_id uuid, workstream_id uuid, activity_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 500), storage_path text not null check (char_length(trim(storage_path)) between 1 and 1024),
  mime_type text not null, size_bytes bigint not null check (size_bytes >= 0), document_type text not null default '', origin text not null default 'received',
  status text not null default 'pending', document_date date, received_on date, assigned_to uuid references public.crm_profiles(id) on delete set null,
  confidentiality text not null default 'normal' check (confidentiality in ('normal', 'restricted', 'confidential')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'), version integer not null default 1 check (version > 0),
  created_by uuid references public.crm_profiles(id) on delete set null, updated_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (firm_id, storage_path),
  foreign key (firm_id, case_id) references public.crm_cases(firm_id, id) on delete set null,
  foreign key (firm_id, case_id, workstream_id) references public.crm_case_workstreams(firm_id, case_id, id) on delete set null,
  foreign key (firm_id, case_id, activity_id) references public.crm_case_activities(firm_id, case_id, id) on delete set null,
  check (workstream_id is null or case_id is not null), check (activity_id is null or case_id is not null)
);

create table public.crm_case_tasks (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null, case_id uuid not null, workstream_id uuid,
  title text not null check (char_length(trim(title)) between 1 and 300), description text not null default '', assigned_to uuid references public.crm_profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  priority public.crm_priority not null default 'medium', starts_on date, due_on date, completed_on date, sort_order integer not null default 0,
  result text not null default '', details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'), version integer not null default 1 check (version > 0),
  created_by uuid references public.crm_profiles(id) on delete set null, updated_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (firm_id, case_id, id),
  foreign key (firm_id, case_id) references public.crm_cases(firm_id, id) on delete cascade,
  foreign key (firm_id, case_id, workstream_id) references public.crm_case_workstreams(firm_id, case_id, id) on delete set null
);

create table public.crm_case_dates (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null, case_id uuid not null, workstream_id uuid, task_id uuid,
  date_type text not null, title text not null check (char_length(trim(title)) between 1 and 300), occurs_at timestamptz not null,
  ends_at timestamptz, assigned_to uuid references public.crm_profiles(id) on delete set null, status text not null default 'pending',
  priority public.crm_priority not null default 'medium', validated boolean not null default false, details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  version integer not null default 1 check (version > 0), created_by uuid references public.crm_profiles(id) on delete set null, updated_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (firm_id, case_id) references public.crm_cases(firm_id, id) on delete cascade,
  foreign key (firm_id, case_id, workstream_id) references public.crm_case_workstreams(firm_id, case_id, id) on delete set null,
  foreign key (firm_id, case_id, task_id) references public.crm_case_tasks(firm_id, case_id, id) on delete set null,
  check (ends_at is null or ends_at >= occurs_at)
);

create table public.crm_case_communications (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null, case_id uuid, workstream_id uuid, contact_id uuid,
  direction text not null check (direction in ('inbound', 'outbound')), communication_type text not null, channel text not null,
  subject text not null default '', content text not null default '', occurred_at timestamptz not null default now(), assigned_to uuid references public.crm_profiles(id) on delete set null,
  triage_status text not null default 'pending', sent_status text not null default 'draft', details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  version integer not null default 1 check (version > 0), created_by uuid references public.crm_profiles(id) on delete set null, updated_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (firm_id, case_id) references public.crm_cases(firm_id, id) on delete set null,
  foreign key (firm_id, case_id, workstream_id) references public.crm_case_workstreams(firm_id, case_id, id) on delete set null,
  foreign key (firm_id, contact_id) references public.crm_contacts(firm_id, id) on delete set null
);

create table public.crm_case_participants (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null, case_id uuid not null, contact_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 300), role text not null, confidentiality text not null default 'normal' check (confidentiality in ('normal', 'restricted', 'confidential')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'), created_at timestamptz not null default now(),
  foreign key (firm_id, case_id) references public.crm_cases(firm_id, id) on delete cascade,
  foreign key (firm_id, contact_id) references public.crm_contacts(firm_id, id) on delete set null
);

create table public.crm_onboardings (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null, contact_id uuid not null, opportunity_id uuid, case_id uuid,
  reference text not null check (char_length(trim(reference)) between 1 and 120), matter_title text not null check (char_length(trim(matter_title)) between 1 and 300),
  phase text not null check (phase in ('proforma', 'payment', 'formal_start', 'completed')), phase_changed_on date not null default current_date,
  quote_reference text, quote_amount numeric(12,2), proforma_sent_on date not null, payment_confirmed_on date, formal_start_scheduled_at timestamptz,
  formal_start_completed_at timestamptz, assigned_to uuid references public.crm_profiles(id) on delete set null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'), version integer not null default 1 check (version > 0),
  created_by uuid references public.crm_profiles(id) on delete set null, updated_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (firm_id, reference), unique (firm_id, opportunity_id),
  foreign key (firm_id, contact_id) references public.crm_contacts(firm_id, id) on delete restrict,
  foreign key (firm_id, opportunity_id) references public.crm_opportunities(firm_id, id) on delete set null,
  foreign key (firm_id, case_id) references public.crm_cases(firm_id, id) on delete set null
);

create table public.crm_notes (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.crm_firms(id) on delete restrict,
  scope text not null check (scope in ('person', 'case', 'opportunity', 'execution', 'quote')), origin_id uuid not null, origin_label text not null,
  title text, content text not null check (char_length(trim(content)) between 1 and 20000), case_id uuid, opportunity_id uuid,
  status text not null default 'active' check (status in ('active', 'resolved', 'archived')), highlighted boolean not null default false, critical boolean not null default false,
  requires_acknowledgement boolean not null default false, validity text not null default 'permanent' check (validity in ('permanent', 'temporary')),
  starts_on date, review_on date, expires_on date, expiry_action text not null default 'archive' check (expiry_action in ('archive', 'confirm')),
  review_pending boolean not null default false, snoozed_until date, visibility text not null default 'team' check (visibility in ('team', 'restricted')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'), version integer not null default 1 check (version > 0),
  created_by uuid references public.crm_profiles(id) on delete set null, updated_by uuid references public.crm_profiles(id) on delete set null,
  resolved_by uuid references public.crm_profiles(id) on delete set null, resolved_at timestamptz, archived_by uuid references public.crm_profiles(id) on delete set null, archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (firm_id, id),
  foreign key (firm_id, case_id) references public.crm_cases(firm_id, id) on delete set null,
  foreign key (firm_id, opportunity_id) references public.crm_opportunities(firm_id, id) on delete set null,
  check ((validity = 'permanent' and expires_on is null) or (validity = 'temporary' and expires_on is not null))
);

create table public.crm_note_contacts (
  note_id uuid not null, firm_id uuid not null, contact_id uuid not null, primary key (note_id, contact_id),
  foreign key (firm_id, note_id) references public.crm_notes(firm_id, id) on delete cascade,
  foreign key (firm_id, contact_id) references public.crm_contacts(firm_id, id) on delete restrict
);

create table public.crm_note_permissions (
  note_id uuid not null, firm_id uuid not null, user_id uuid not null references public.crm_profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (note_id, user_id), foreign key (firm_id, note_id) references public.crm_notes(firm_id, id) on delete cascade
);

create table public.crm_note_acknowledgements (
  note_id uuid not null references public.crm_notes(id) on delete cascade, user_id uuid not null references public.crm_profiles(id) on delete cascade,
  acknowledged_at timestamptz not null default now(), primary key (note_id, user_id)
);

create table public.crm_note_events (
  id uuid primary key default gen_random_uuid(), note_id uuid not null references public.crm_notes(id) on delete cascade, firm_id uuid not null,
  event_type text not null check (char_length(trim(event_type)) between 1 and 120), detail text, actor_id uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(), foreign key (firm_id, note_id) references public.crm_notes(firm_id, id) on delete cascade
);

create table public.crm_ai_intake_sessions (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null references public.crm_firms(id) on delete restrict,
  form_type text not null check (form_type in ('contact', 'opportunity', 'case', 'participant', 'professional')), context text, target_id uuid,
  applied boolean not null default false, data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  created_by uuid references public.crm_profiles(id) on delete set null, updated_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (firm_id, id)
);

create table public.crm_ai_intake_documents (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.crm_ai_intake_sessions(id) on delete cascade, firm_id uuid not null,
  name text not null, storage_path text not null, mime_type text not null, size_bytes bigint not null check (size_bytes >= 0), processing_status text not null default 'pending', error_message text,
  created_at timestamptz not null default now(), unique (firm_id, storage_path), foreign key (firm_id, session_id) references public.crm_ai_intake_sessions(firm_id, id) on delete cascade
);

create or replace function public.crm_assign_case_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.case_number is null then
    update public.crm_firms set case_sequence = case_sequence + 1 where id = new.firm_id returning case_sequence into new.case_number;
  end if;
  return new;
end;
$$;

create or replace function public.crm_validate_case_storage_path()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.storage_path not like new.firm_id::text || '/%' then
    raise exception 'Document storage path must start with its firm ID';
  end if;
  return new;
end;
$$;

create or replace function public.crm_assign_note_event_actor()
returns trigger language plpgsql set search_path = public as $$
begin new.actor_id = auth.uid(); return new; end;
$$;

create trigger crm_cases_assign_number before insert on public.crm_cases for each row execute function public.crm_assign_case_number();
create trigger crm_cases_audit before insert on public.crm_cases for each row execute function public.crm_assign_contact_audit();
create trigger crm_cases_touch before update on public.crm_cases for each row execute function public.crm_touch_entity();
create trigger crm_case_workstreams_audit before insert on public.crm_case_workstreams for each row execute function public.crm_assign_contact_audit();
create trigger crm_case_workstreams_touch before update on public.crm_case_workstreams for each row execute function public.crm_touch_entity();
create trigger crm_case_activities_audit before insert on public.crm_case_activities for each row execute function public.crm_assign_contact_audit();
create trigger crm_case_activities_touch before update on public.crm_case_activities for each row execute function public.crm_touch_entity();
create trigger crm_case_documents_validate_path before insert or update on public.crm_case_documents for each row execute function public.crm_validate_case_storage_path();
create trigger crm_case_documents_audit before insert on public.crm_case_documents for each row execute function public.crm_assign_contact_audit();
create trigger crm_case_documents_touch before update on public.crm_case_documents for each row execute function public.crm_touch_entity();
create trigger crm_case_tasks_audit before insert on public.crm_case_tasks for each row execute function public.crm_assign_contact_audit();
create trigger crm_case_tasks_touch before update on public.crm_case_tasks for each row execute function public.crm_touch_entity();
create trigger crm_case_dates_audit before insert on public.crm_case_dates for each row execute function public.crm_assign_contact_audit();
create trigger crm_case_dates_touch before update on public.crm_case_dates for each row execute function public.crm_touch_entity();
create trigger crm_case_communications_audit before insert on public.crm_case_communications for each row execute function public.crm_assign_contact_audit();
create trigger crm_case_communications_touch before update on public.crm_case_communications for each row execute function public.crm_touch_entity();
create trigger crm_onboardings_audit before insert on public.crm_onboardings for each row execute function public.crm_assign_contact_audit();
create trigger crm_onboardings_touch before update on public.crm_onboardings for each row execute function public.crm_touch_entity();
create trigger crm_notes_audit before insert on public.crm_notes for each row execute function public.crm_assign_contact_audit();
create trigger crm_notes_touch before update on public.crm_notes for each row execute function public.crm_touch_entity();
create trigger crm_note_events_audit before insert on public.crm_note_events for each row execute function public.crm_assign_note_event_actor();
create trigger crm_ai_intake_sessions_audit before insert on public.crm_ai_intake_sessions for each row execute function public.crm_assign_contact_audit();
create trigger crm_ai_intake_sessions_touch before update on public.crm_ai_intake_sessions for each row execute function public.crm_touch_entity();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('case-documents', 'case-documents', false, 52428800, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'message/rfc822'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.crm_can_access_case_storage(object_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select object_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
    and public.crm_is_firm_member(substring(object_path from 1 for 36)::uuid);
$$;
revoke all on function public.crm_can_access_case_storage(text) from public, anon;
grant execute on function public.crm_can_access_case_storage(text) to authenticated;

alter table public.crm_cases enable row level security;
alter table public.crm_case_contacts enable row level security;
alter table public.crm_case_workstreams enable row level security;
alter table public.crm_case_activities enable row level security;
alter table public.crm_case_documents enable row level security;
alter table public.crm_case_tasks enable row level security;
alter table public.crm_case_dates enable row level security;
alter table public.crm_case_communications enable row level security;
alter table public.crm_case_participants enable row level security;
alter table public.crm_onboardings enable row level security;
alter table public.crm_notes enable row level security;
alter table public.crm_note_contacts enable row level security;
alter table public.crm_note_permissions enable row level security;
alter table public.crm_note_acknowledgements enable row level security;
alter table public.crm_note_events enable row level security;
alter table public.crm_ai_intake_sessions enable row level security;
alter table public.crm_ai_intake_documents enable row level security;

create policy crm_cases_member on public.crm_cases for all to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_case_contacts_member on public.crm_case_contacts for all to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_case_workstreams_member on public.crm_case_workstreams for all to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_case_activities_member on public.crm_case_activities for all to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_case_documents_member on public.crm_case_documents for all to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_case_tasks_member on public.crm_case_tasks for all to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_case_dates_member on public.crm_case_dates for all to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_case_communications_member on public.crm_case_communications for all to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_case_participants_member on public.crm_case_participants for all to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_onboardings_member on public.crm_onboardings for all to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_notes_read on public.crm_notes for select to authenticated using (public.crm_is_firm_member(firm_id) and (visibility = 'team' or created_by = (select auth.uid()) or exists (select 1 from public.crm_note_permissions where note_id = id and user_id = (select auth.uid()))));
create policy crm_notes_create on public.crm_notes for insert to authenticated with check (public.crm_is_firm_member(firm_id) and created_by = (select auth.uid()));
create policy crm_notes_update on public.crm_notes for update to authenticated using (public.crm_is_firm_member(firm_id) and (created_by = (select auth.uid()) or public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]))) with check (public.crm_is_firm_member(firm_id));
create policy crm_note_contacts_read on public.crm_note_contacts for select to authenticated using (exists (select 1 from public.crm_notes where id = note_id));
create policy crm_note_contacts_write on public.crm_note_contacts for all to authenticated using (exists (select 1 from public.crm_notes where id = note_id and (created_by = (select auth.uid()) or public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[])))) with check (exists (select 1 from public.crm_notes where id = note_id and (created_by = (select auth.uid()) or public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]))));
create policy crm_note_permissions_read on public.crm_note_permissions for select to authenticated using (user_id = (select auth.uid()));
create policy crm_note_permissions_write on public.crm_note_permissions for all to authenticated using (exists (select 1 from public.crm_notes where id = note_id and (created_by = (select auth.uid()) or public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[])))) with check (exists (select 1 from public.crm_notes where id = note_id and (created_by = (select auth.uid()) or public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]))));
create policy crm_note_acknowledgements_read on public.crm_note_acknowledgements for select to authenticated using (user_id = (select auth.uid()) or exists (select 1 from public.crm_notes where id = note_id and created_by = (select auth.uid())));
create policy crm_note_acknowledgements_create on public.crm_note_acknowledgements for insert to authenticated with check (user_id = (select auth.uid()) and exists (select 1 from public.crm_notes where id = note_id));
create policy crm_note_events_read on public.crm_note_events for select to authenticated using (exists (select 1 from public.crm_notes where id = note_id));
create policy crm_note_events_create on public.crm_note_events for insert to authenticated with check (public.crm_is_firm_member(firm_id));
create policy crm_ai_intake_sessions_member on public.crm_ai_intake_sessions for all to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_ai_intake_documents_member on public.crm_ai_intake_documents for all to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));

create policy crm_case_documents_storage_read on storage.objects for select to authenticated using (bucket_id = 'case-documents' and public.crm_can_access_case_storage(name));
create policy crm_case_documents_storage_insert on storage.objects for insert to authenticated with check (bucket_id = 'case-documents' and public.crm_can_access_case_storage(name));
create policy crm_case_documents_storage_update on storage.objects for update to authenticated using (bucket_id = 'case-documents' and public.crm_can_access_case_storage(name)) with check (bucket_id = 'case-documents' and public.crm_can_access_case_storage(name));
create policy crm_case_documents_storage_delete on storage.objects for delete to authenticated using (bucket_id = 'case-documents' and public.crm_can_access_case_storage(name));

grant select, insert, update, delete on public.crm_cases, public.crm_case_contacts, public.crm_case_workstreams, public.crm_case_activities, public.crm_case_documents, public.crm_case_tasks, public.crm_case_dates, public.crm_case_communications, public.crm_case_participants, public.crm_onboardings, public.crm_notes, public.crm_note_contacts, public.crm_note_permissions, public.crm_note_acknowledgements, public.crm_note_events, public.crm_ai_intake_sessions, public.crm_ai_intake_documents to authenticated;

create index crm_cases_firm_status_updated_idx on public.crm_cases (firm_id, general_status, updated_at desc);
create index crm_cases_firm_contact_idx on public.crm_cases (firm_id, primary_contact_id);
create index crm_case_workstreams_case_sort_idx on public.crm_case_workstreams (firm_id, case_id, sort_order);
create index crm_case_activities_case_occurred_idx on public.crm_case_activities (firm_id, case_id, occurred_at desc);
create index crm_case_documents_case_created_idx on public.crm_case_documents (firm_id, case_id, created_at desc);
create index crm_case_tasks_firm_status_due_idx on public.crm_case_tasks (firm_id, status, due_on);
create index crm_case_dates_firm_occurs_idx on public.crm_case_dates (firm_id, occurs_at);
create index crm_case_communications_firm_occurred_idx on public.crm_case_communications (firm_id, occurred_at desc);
create index crm_onboardings_firm_phase_changed_idx on public.crm_onboardings (firm_id, phase, phase_changed_on);
create index crm_notes_firm_created_idx on public.crm_notes (firm_id, created_at desc);
create index crm_notes_case_idx on public.crm_notes (firm_id, case_id) where case_id is not null;
create index crm_notes_opportunity_idx on public.crm_notes (firm_id, opportunity_id) where opportunity_id is not null;
create index crm_note_contacts_contact_idx on public.crm_note_contacts (firm_id, contact_id);
create index crm_note_permissions_user_idx on public.crm_note_permissions (user_id, note_id);
create index crm_note_events_note_created_idx on public.crm_note_events (note_id, created_at desc);
create index crm_ai_intake_sessions_firm_created_idx on public.crm_ai_intake_sessions (firm_id, created_at desc);
