-- Administrators may disable another administrator for removal, but cannot change
-- administrator roles or reactivate them. Owners remain protected.
create or replace function public.crm_update_firm_member(
  target_firm_id uuid, target_user_id uuid, new_role public.crm_member_role,
  new_status public.crm_member_status
)
returns void language plpgsql security definer set search_path = public as $$
declare actor_role public.crm_member_role; current_role public.crm_member_role;
begin
  select role into actor_role from public.crm_firm_members
  where firm_id = target_firm_id and user_id = auth.uid() and status = 'active';
  if auth.uid() is null or actor_role is null or actor_role not in ('owner', 'admin') then
    raise exception 'An owner or administrator is required';
  end if;
  select role into current_role from public.crm_firm_members
  where firm_id = target_firm_id and user_id = target_user_id;
  if not found then raise exception 'Member not found'; end if;
  if target_user_id = auth.uid() or current_role = 'owner' or new_role = 'owner' then
    raise exception 'Owner access cannot be changed here';
  end if;
  if new_status = 'invited' then raise exception 'Invitations must be created through the invitation flow'; end if;
  if actor_role = 'admin' and (current_role = 'admin' or new_role = 'admin')
    and not (current_role = 'admin' and new_role = 'admin' and new_status = 'disabled') then
    raise exception 'Only the owner can administer administrator access';
  end if;
  update public.crm_firm_members set role = new_role, status = new_status
  where firm_id = target_firm_id and user_id = target_user_id;
end;
$$;

create or replace function public.crm_get_firm_member_assignment_count(target_firm_id uuid, target_user_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare actor_role public.crm_member_role; current_role public.crm_member_role;
  current_status public.crm_member_status; assignment_count integer;
begin
  select role into actor_role from public.crm_firm_members
  where firm_id = target_firm_id and user_id = auth.uid() and status = 'active';
  if auth.uid() is null or actor_role is null or actor_role not in ('owner', 'admin') then
    raise exception 'An owner or administrator is required';
  end if;
  select role, status into current_role, current_status from public.crm_firm_members
  where firm_id = target_firm_id and user_id = target_user_id;
  if not found then raise exception 'Member not found'; end if;
  if target_user_id = auth.uid() or current_role = 'owner' then raise exception 'Owner or own access cannot be removed'; end if;
  if current_status <> 'disabled' then raise exception 'Only disabled members can be removed'; end if;
  select count(*)::integer into assignment_count from (
    select 1 from public.crm_opportunities where firm_id = target_firm_id and assigned_to = target_user_id
    union all select 1 from public.crm_tasks where firm_id = target_firm_id and assigned_to = target_user_id
    union all select 1 from public.crm_cases where firm_id = target_firm_id and assigned_to = target_user_id
    union all select 1 from public.crm_case_tasks where firm_id = target_firm_id and assigned_to = target_user_id
    union all select 1 from public.crm_case_workstreams where firm_id = target_firm_id and assigned_to = target_user_id
    union all select 1 from public.crm_case_dates where firm_id = target_firm_id and assigned_to = target_user_id
    union all select 1 from public.crm_case_communications where firm_id = target_firm_id and assigned_to = target_user_id
    union all select 1 from public.crm_case_documents where firm_id = target_firm_id and assigned_to = target_user_id
    union all select 1 from public.crm_onboardings where firm_id = target_firm_id and assigned_to = target_user_id
  ) assignments;
  return assignment_count;
end;
$$;

-- Complete the removal only after Auth has disabled and anonymized the account.
-- The legacy RPC remains unavailable to browser clients.
revoke execute on function public.crm_delete_firm_member(uuid, uuid) from authenticated;
create table public.crm_member_removal_reservations (
  user_id uuid primary key references public.crm_profiles(id) on delete cascade,
  firm_id uuid not null references public.crm_firms(id) on delete restrict
);
revoke all on public.crm_member_removal_reservations from public, anon, authenticated;
alter table public.crm_member_removal_reservations enable row level security;

-- Serialize membership changes against the reservation so an account cannot be
-- promoted or added to another firm while Auth is deleting it.
create or replace function public.crm_guard_member_removal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if exists (select 1 from public.crm_member_removal_reservations where user_id = new.user_id)
    or exists (select 1 from auth.users where id = new.user_id and deleted_at is not null) then
    raise exception 'Account removal is in progress or complete';
  end if;
  return new;
end;
$$;
create trigger crm_guard_member_removal before insert or update on public.crm_firm_members
  for each row execute function public.crm_guard_member_removal();

create or replace function public.crm_reserve_firm_member_removal(target_firm_id uuid, target_user_id uuid, actor_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare member_role public.crm_member_role; member_status public.crm_member_status;
begin
  perform pg_advisory_xact_lock(hashtextextended(target_user_id::text, 0));
  if actor_id = target_user_id or not exists (
    select 1 from public.crm_firm_members where firm_id = target_firm_id and user_id = actor_id
      and status = 'active' and role in ('owner', 'admin')
  ) then raise exception 'An owner or administrator is required'; end if;
  select role, status into member_role, member_status from public.crm_firm_members
  where firm_id = target_firm_id and user_id = target_user_id for update;
  if not found or member_role = 'owner' or member_status <> 'disabled'
    or exists (select 1 from public.crm_firm_members where user_id = target_user_id and firm_id <> target_firm_id) then
    raise exception 'Member cannot be removed';
  end if;
  insert into public.crm_member_removal_reservations (user_id, firm_id)
  values (target_user_id, target_firm_id) on conflict (user_id) do nothing;
  if not exists (select 1 from public.crm_member_removal_reservations
    where user_id = target_user_id and firm_id = target_firm_id) then
    raise exception 'Member cannot be removed';
  end if;
end;
$$;
revoke all on function public.crm_reserve_firm_member_removal(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.crm_reserve_firm_member_removal(uuid, uuid, uuid) to service_role;

create or replace function public.crm_finish_firm_member_removal(target_firm_id uuid, target_user_id uuid, actor_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare member_role public.crm_member_role; member_status public.crm_member_status;
begin
  perform pg_advisory_xact_lock(hashtextextended(target_user_id::text, 0));
  if actor_id = target_user_id or not exists (
    select 1 from public.crm_firm_members where firm_id = target_firm_id and user_id = actor_id
      and status = 'active' and role in ('owner', 'admin')
  ) then raise exception 'An owner or administrator is required'; end if;
  select role, status into member_role, member_status from public.crm_firm_members
  where firm_id = target_firm_id and user_id = target_user_id for update;
  if not found or member_role = 'owner' or member_status <> 'disabled' then
    raise exception 'Member cannot be removed';
  end if;
  if not exists (select 1 from public.crm_member_removal_reservations where user_id = target_user_id and firm_id = target_firm_id)
    or exists (select 1 from public.crm_firm_members where user_id = target_user_id and firm_id <> target_firm_id)
    or not exists (select 1 from auth.users where id = target_user_id and deleted_at is not null) then
    raise exception 'Account cannot be removed';
  end if;
  update public.crm_opportunities set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_tasks set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_cases set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_case_tasks set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_case_workstreams set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_case_dates set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_case_communications set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_case_documents set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_onboardings set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  delete from public.crm_firm_members where firm_id = target_firm_id and user_id = target_user_id;
  delete from public.crm_member_removal_reservations where user_id = target_user_id;
end;
$$;
revoke all on function public.crm_finish_firm_member_removal(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.crm_finish_firm_member_removal(uuid, uuid, uuid) to service_role;

-- The invitation email can be opened before the membership insert finishes.
create or replace function public.crm_prepare_invited_member()
returns trigger language plpgsql security definer set search_path = public as $$
declare confirmed_at timestamptz;
begin
  if new.status = 'invited' then
    select email_confirmed_at into confirmed_at from auth.users where id = new.user_id for update;
    if confirmed_at is not null then new.status := 'active'; end if;
  end if;
  return new;
end;
$$;
create trigger crm_prepare_invited_member before insert on public.crm_firm_members
  for each row execute function public.crm_prepare_invited_member();
