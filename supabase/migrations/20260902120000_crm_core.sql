-- LEX CRM: núcleo multi-despacho. No contiene datos de demostración.
create extension if not exists pgcrypto;

create type public.crm_member_role as enum ('owner', 'admin', 'lawyer', 'paralegal');
create type public.crm_member_status as enum ('invited', 'active', 'disabled');
create type public.crm_contact_nature as enum ('person', 'company', 'court', 'public_body');
create type public.crm_contact_relationship as enum ('lead', 'client', 'collaborator', 'third_party', 'counterparty', 'supplier');
create type public.crm_contact_status as enum ('active', 'inactive', 'archived');
create type public.crm_opportunity_stage as enum ('entry', 'qualification', 'first_meeting', 'quote', 'validation', 'engagement', 'won', 'lost');
create type public.crm_priority as enum ('low', 'medium', 'high');

create table public.crm_firms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_firm_members (
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  user_id uuid not null references public.crm_profiles(id) on delete cascade,
  role public.crm_member_role not null default 'paralegal',
  status public.crm_member_status not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (firm_id, user_id)
);

create sequence public.crm_contact_reference_seq start with 1000;
create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete restrict,
  reference text not null unique default ('CT-' || lpad(nextval('public.crm_contact_reference_seq')::text, 6, '0')),
  nature public.crm_contact_nature not null,
  relationship public.crm_contact_relationship not null,
  status public.crm_contact_status not null default 'active',
  display_name text not null check (char_length(trim(display_name)) between 1 and 240),
  first_name text,
  last_name text,
  legal_name text,
  tax_id text,
  email text,
  phone text,
  source text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  version integer not null default 1 check (version > 0),
  created_by uuid references public.crm_profiles(id) on delete set null,
  updated_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (firm_id, tax_id)
);

create index crm_contacts_firm_status_idx on public.crm_contacts (firm_id, status, display_name);
create index crm_contacts_firm_email_idx on public.crm_contacts (firm_id, lower(email)) where email is not null;

create sequence public.crm_opportunity_reference_seq start with 1000;
create table public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete restrict,
  reference text not null unique default ('OP-' || lpad(nextval('public.crm_opportunity_reference_seq')::text, 6, '0')),
  contact_id uuid not null references public.crm_contacts(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 300),
  area text not null default '',
  stage public.crm_opportunity_stage not null default 'entry',
  substage text not null default 'Sin revisar',
  priority public.crm_priority not null default 'medium',
  operational_status text not null default 'Debemos trabajo',
  source text not null default '',
  description text not null default '',
  assigned_to uuid references public.crm_profiles(id) on delete set null,
  estimated_amount numeric(14, 2),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  version integer not null default 1 check (version > 0),
  created_by uuid references public.crm_profiles(id) on delete set null,
  updated_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index crm_opportunities_firm_stage_idx on public.crm_opportunities (firm_id, stage, updated_at desc);
create index crm_opportunities_contact_idx on public.crm_opportunities (contact_id);

create table public.crm_opportunity_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete restrict,
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  event_type text not null check (char_length(trim(event_type)) between 1 and 120),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  actor_id uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index crm_opportunity_events_opportunity_idx on public.crm_opportunity_events (opportunity_id, created_at desc);

create or replace function public.crm_touch_timestamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.crm_touch_entity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  new.version = old.version + 1;
  return new;
end;
$$;

create or replace function public.crm_assign_contact_audit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by = auth.uid();
    new.updated_by = auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.crm_assign_event_actor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.actor_id = auth.uid();
  return new;
end;
$$;

create trigger crm_firms_touch before update on public.crm_firms for each row execute function public.crm_touch_timestamp();
create trigger crm_profiles_touch before update on public.crm_profiles for each row execute function public.crm_touch_timestamp();
create trigger crm_firm_members_touch before update on public.crm_firm_members for each row execute function public.crm_touch_timestamp();
create trigger crm_contacts_audit before insert on public.crm_contacts for each row execute function public.crm_assign_contact_audit();
create trigger crm_contacts_touch before update on public.crm_contacts for each row execute function public.crm_touch_entity();
create trigger crm_opportunities_audit before insert on public.crm_opportunities for each row execute function public.crm_assign_contact_audit();
create trigger crm_opportunities_touch before update on public.crm_opportunities for each row execute function public.crm_touch_entity();
create trigger crm_opportunity_events_audit before insert on public.crm_opportunity_events for each row execute function public.crm_assign_event_actor();

create or replace function public.crm_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.crm_profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.crm_handle_new_user();

create or replace function public.crm_is_firm_member(target_firm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.crm_firm_members
    where firm_id = target_firm_id and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.crm_shares_firm(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.crm_firm_members mine
    join public.crm_firm_members theirs on theirs.firm_id = mine.firm_id
    where mine.user_id = auth.uid()
      and mine.status = 'active'
      and theirs.user_id = target_user_id
      and theirs.status = 'active'
  );
$$;

create or replace function public.crm_bootstrap_firm(firm_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_firm_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists (select 1 from public.crm_firm_members where user_id = auth.uid()) then
    raise exception 'A firm membership already exists for this user';
  end if;
  insert into public.crm_firms (name) values (trim(firm_name)) returning id into new_firm_id;
  insert into public.crm_firm_members (firm_id, user_id, role, status)
  values (new_firm_id, auth.uid(), 'owner', 'active');
  return new_firm_id;
end;
$$;

alter table public.crm_firms enable row level security;
alter table public.crm_profiles enable row level security;
alter table public.crm_firm_members enable row level security;
alter table public.crm_contacts enable row level security;
alter table public.crm_opportunities enable row level security;
alter table public.crm_opportunity_events enable row level security;

create policy crm_firms_select on public.crm_firms for select using (public.crm_is_firm_member(id));
create policy crm_firms_update on public.crm_firms for update using (public.crm_is_firm_member(id)) with check (public.crm_is_firm_member(id));

create policy crm_profiles_select on public.crm_profiles for select using (id = auth.uid() or public.crm_shares_firm(id));
create policy crm_profiles_update_self on public.crm_profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy crm_firm_members_select on public.crm_firm_members for select using (user_id = auth.uid() or public.crm_is_firm_member(firm_id));

create policy crm_contacts_select on public.crm_contacts for select using (public.crm_is_firm_member(firm_id));
create policy crm_contacts_insert on public.crm_contacts for insert with check (public.crm_is_firm_member(firm_id));
create policy crm_contacts_update on public.crm_contacts for update using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));

create policy crm_opportunities_select on public.crm_opportunities for select using (public.crm_is_firm_member(firm_id));
create policy crm_opportunities_insert on public.crm_opportunities for insert with check (public.crm_is_firm_member(firm_id));
create policy crm_opportunities_update on public.crm_opportunities for update using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));

create policy crm_opportunity_events_select on public.crm_opportunity_events for select using (public.crm_is_firm_member(firm_id));
create policy crm_opportunity_events_insert on public.crm_opportunity_events for insert with check (public.crm_is_firm_member(firm_id));

grant usage on schema public to authenticated;
grant select, insert, update on public.crm_firms, public.crm_profiles, public.crm_firm_members, public.crm_contacts, public.crm_opportunities, public.crm_opportunity_events to authenticated;
grant usage, select on sequence public.crm_contact_reference_seq, public.crm_opportunity_reference_seq to authenticated;
grant execute on function public.crm_bootstrap_firm(text) to authenticated;
