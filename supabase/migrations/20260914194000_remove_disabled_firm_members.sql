create or replace function public.crm_get_firm_member_assignment_count(
  target_firm_id uuid,
  target_user_id uuid
)
returns integer language plpgsql security definer set search_path = public as $$
declare
  actor_role public.crm_member_role;
  current_role public.crm_member_role;
  current_status public.crm_member_status;
  assignment_count integer;
begin
  select role into actor_role from public.crm_firm_members
  where firm_id = target_firm_id and user_id = auth.uid() and status = 'active';
  if auth.uid() is null or actor_role is null or actor_role not in ('owner', 'admin') then
    raise exception 'An owner or administrator is required';
  end if;

  select role, status into current_role, current_status from public.crm_firm_members
  where firm_id = target_firm_id and user_id = target_user_id;
  if not found then raise exception 'Member not found'; end if;
  if current_status <> 'disabled' then raise exception 'Only disabled members can be removed'; end if;
  if current_role = 'owner' then raise exception 'Owner access cannot be removed'; end if;
  if actor_role = 'admin' and current_role = 'admin' then
    raise exception 'Only the owner can administer administrator access';
  end if;

  select count(*)::integer into assignment_count from (
    select 1 from public.crm_opportunities where firm_id = target_firm_id and assigned_to = target_user_id
    union all select 1 from public.crm_tasks where firm_id = target_firm_id and assigned_to = target_user_id
    union all select 1 from public.crm_cases where firm_id = target_firm_id and assigned_to = target_user_id
    union all select 1 from public.crm_case_activities where firm_id = target_firm_id and assigned_to = target_user_id
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

create or replace function public.crm_delete_firm_member(
  target_firm_id uuid,
  target_user_id uuid
)
returns integer language plpgsql security definer set search_path = public as $$
declare
  actor_role public.crm_member_role;
  current_role public.crm_member_role;
  current_status public.crm_member_status;
  released_assignments integer;
begin
  select role into actor_role from public.crm_firm_members
  where firm_id = target_firm_id and user_id = auth.uid() and status = 'active';
  if auth.uid() is null or actor_role is null or actor_role not in ('owner', 'admin') then
    raise exception 'An owner or administrator is required';
  end if;

  select role, status into current_role, current_status from public.crm_firm_members
  where firm_id = target_firm_id and user_id = target_user_id;
  if not found then raise exception 'Member not found'; end if;
  if current_status <> 'disabled' then raise exception 'Only disabled members can be removed'; end if;
  if current_role = 'owner' then raise exception 'Owner access cannot be removed'; end if;
  if actor_role = 'admin' and current_role = 'admin' then
    raise exception 'Only the owner can administer administrator access';
  end if;

  released_assignments := public.crm_get_firm_member_assignment_count(target_firm_id, target_user_id);
  update public.crm_opportunities set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_tasks set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_cases set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_case_activities set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_case_tasks set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_case_workstreams set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_case_dates set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_case_communications set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_case_documents set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  update public.crm_onboardings set assigned_to = null where firm_id = target_firm_id and assigned_to = target_user_id;
  delete from public.crm_firm_members
  where firm_id = target_firm_id and user_id = target_user_id and status = 'disabled';
  if not found then raise exception 'Only disabled members can be removed'; end if;
  return released_assignments;
end;
$$;

revoke all on function public.crm_get_firm_member_assignment_count(uuid, uuid) from public, anon;
revoke all on function public.crm_delete_firm_member(uuid, uuid) from public, anon;
grant execute on function public.crm_get_firm_member_assignment_count(uuid, uuid) to authenticated;
grant execute on function public.crm_delete_firm_member(uuid, uuid) to authenticated;