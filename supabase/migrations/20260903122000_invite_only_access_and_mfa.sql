-- Close the one-time bootstrap after the initial firm has been provisioned.
create or replace function public.crm_bootstrap_firm(firm_name text)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Firm bootstrap is closed; access is granted by invitation only';
end;
$$;
revoke execute on function public.crm_bootstrap_firm(text) from authenticated;

-- Authenticated users need an elevated MFA session before administrative changes.
create or replace function public.crm_is_aal2()
returns boolean language sql stable security invoker set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;
revoke all on function public.crm_is_aal2() from public, anon;
grant execute on function public.crm_is_aal2() to authenticated;

drop policy if exists crm_firms_require_mfa_update on public.crm_firms;
create policy crm_firms_require_mfa_update on public.crm_firms as restrictive
  for update to authenticated using (public.crm_is_aal2()) with check (public.crm_is_aal2());
drop policy if exists crm_firm_settings_require_mfa_insert on public.crm_firm_settings;
create policy crm_firm_settings_require_mfa_insert on public.crm_firm_settings as restrictive
  for insert to authenticated with check (public.crm_is_aal2());
drop policy if exists crm_firm_settings_require_mfa_update on public.crm_firm_settings;
create policy crm_firm_settings_require_mfa_update on public.crm_firm_settings as restrictive
  for update to authenticated using (public.crm_is_aal2()) with check (public.crm_is_aal2());

create or replace function public.crm_update_firm_member(
  target_firm_id uuid, target_user_id uuid, new_role public.crm_member_role,
  new_status public.crm_member_status
)
returns void language plpgsql security definer set search_path = public as $$
declare actor_role public.crm_member_role; current_role public.crm_member_role;
begin
  select role into actor_role from public.crm_firm_members
  where firm_id = target_firm_id and user_id = auth.uid() and status = 'active';
  if auth.uid() is null or actor_role is null or actor_role not in ('owner', 'admin') or not public.crm_is_aal2() then
    raise exception 'An owner or administrator with MFA is required';
  end if;
  select role into current_role from public.crm_firm_members
  where firm_id = target_firm_id and user_id = target_user_id;
  if not found then raise exception 'Member not found'; end if;
  if target_user_id = auth.uid() or current_role = 'owner' or new_role = 'owner' then
    raise exception 'Owner access cannot be changed here';
  end if;
  if new_status = 'invited' then raise exception 'Invitations must be created through the invitation flow'; end if;
  if actor_role = 'admin' and (current_role = 'admin' or new_role = 'admin') then
    raise exception 'Only the owner can administer administrator access';
  end if;
  update public.crm_firm_members set role = new_role, status = new_status
  where firm_id = target_firm_id and user_id = target_user_id;
end;
$$;
revoke all on function public.crm_update_firm_member(uuid, uuid, public.crm_member_role, public.crm_member_status) from public, anon;
grant execute on function public.crm_update_firm_member(uuid, uuid, public.crm_member_role, public.crm_member_status) to authenticated;

create or replace function public.crm_activate_invited_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.crm_firm_members set status = 'active'
    where user_id = new.id and status = 'invited';
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row execute procedure public.crm_activate_invited_member();
