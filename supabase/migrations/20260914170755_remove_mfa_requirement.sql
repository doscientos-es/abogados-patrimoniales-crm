-- Administrative access remains protected by role checks, without requiring MFA.
drop policy if exists crm_firms_require_mfa_update on public.crm_firms;
drop policy if exists crm_firm_settings_require_mfa_insert on public.crm_firm_settings;
drop policy if exists crm_firm_settings_require_mfa_update on public.crm_firm_settings;

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
  if actor_role = 'admin' and (current_role = 'admin' or new_role = 'admin') then
    raise exception 'Only the owner can administer administrator access';
  end if;
  update public.crm_firm_members set role = new_role, status = new_status
  where firm_id = target_firm_id and user_id = target_user_id;
end;
$$;

drop function if exists public.crm_is_aal2();