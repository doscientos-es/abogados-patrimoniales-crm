-- Harden direct API access and prevent relationships crossing firm boundaries.
revoke all on function public.crm_handle_new_user() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

revoke all on function public.crm_is_firm_member(uuid) from public, anon;
revoke all on function public.crm_shares_firm(uuid) from public, anon;
revoke all on function public.crm_has_firm_role(uuid, public.crm_member_role[]) from public, anon;
revoke all on function public.crm_bootstrap_firm(text) from public, anon;
revoke all on function public.crm_transition_opportunity(uuid, public.crm_opportunity_stage, text, text) from public, anon;
grant execute on function public.crm_is_firm_member(uuid) to authenticated;
grant execute on function public.crm_shares_firm(uuid) to authenticated;
grant execute on function public.crm_has_firm_role(uuid, public.crm_member_role[]) to authenticated;
grant execute on function public.crm_bootstrap_firm(text) to authenticated;
grant execute on function public.crm_transition_opportunity(uuid, public.crm_opportunity_stage, text, text) to authenticated;

drop policy if exists crm_firms_select on public.crm_firms;
drop policy if exists crm_firms_update on public.crm_firms;
create policy crm_firms_select on public.crm_firms for select to authenticated using (public.crm_is_firm_member(id));
create policy crm_firms_update on public.crm_firms for update to authenticated using (public.crm_has_firm_role(id, array['owner', 'admin']::public.crm_member_role[])) with check (public.crm_has_firm_role(id, array['owner', 'admin']::public.crm_member_role[]));

drop policy if exists crm_profiles_select on public.crm_profiles;
drop policy if exists crm_profiles_update_self on public.crm_profiles;
create policy crm_profiles_select on public.crm_profiles for select to authenticated using (id = (select auth.uid()) or public.crm_shares_firm(id));
create policy crm_profiles_update_self on public.crm_profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists crm_firm_members_select on public.crm_firm_members;
create policy crm_firm_members_select on public.crm_firm_members for select to authenticated using (user_id = (select auth.uid()) or public.crm_is_firm_member(firm_id));

drop policy if exists crm_contacts_select on public.crm_contacts;
drop policy if exists crm_contacts_insert on public.crm_contacts;
drop policy if exists crm_contacts_update on public.crm_contacts;
create policy crm_contacts_select on public.crm_contacts for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_contacts_insert on public.crm_contacts for insert to authenticated with check (public.crm_is_firm_member(firm_id));
create policy crm_contacts_update on public.crm_contacts for update to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));

drop policy if exists crm_opportunities_select on public.crm_opportunities;
drop policy if exists crm_opportunities_insert on public.crm_opportunities;
create policy crm_opportunities_select on public.crm_opportunities for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_opportunities_insert on public.crm_opportunities for insert to authenticated with check (public.crm_is_firm_member(firm_id));

drop policy if exists crm_opportunity_events_select on public.crm_opportunity_events;
drop policy if exists crm_opportunity_events_insert on public.crm_opportunity_events;
create policy crm_opportunity_events_select on public.crm_opportunity_events for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_opportunity_events_insert on public.crm_opportunity_events for insert to authenticated with check (public.crm_is_firm_member(firm_id));

drop policy if exists crm_tasks_select on public.crm_tasks;
drop policy if exists crm_tasks_insert on public.crm_tasks;
drop policy if exists crm_tasks_update on public.crm_tasks;
create policy crm_tasks_select on public.crm_tasks for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_tasks_insert on public.crm_tasks for insert to authenticated with check (public.crm_is_firm_member(firm_id));
create policy crm_tasks_update on public.crm_tasks for update to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));

drop policy if exists crm_task_events_select on public.crm_task_events;
drop policy if exists crm_task_events_insert on public.crm_task_events;
create policy crm_task_events_select on public.crm_task_events for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_task_events_insert on public.crm_task_events for insert to authenticated with check (public.crm_is_firm_member(firm_id));

create or replace function public.crm_validate_opportunity_firm()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.crm_contacts where id = new.contact_id and firm_id = new.firm_id) then
    raise exception 'Opportunity contact must belong to the same firm';
  end if;
  if new.assigned_to is not null and not exists (select 1 from public.crm_firm_members where firm_id = new.firm_id and user_id = new.assigned_to and status = 'active') then
    raise exception 'Opportunity assignee must be an active member of the same firm';
  end if;
  return new;
end;
$$;

create or replace function public.crm_validate_task_firm()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.crm_opportunities where id = new.opportunity_id and firm_id = new.firm_id) then
    raise exception 'Task opportunity must belong to the same firm';
  end if;
  if new.assigned_to is not null and not exists (select 1 from public.crm_firm_members where firm_id = new.firm_id and user_id = new.assigned_to and status = 'active') then
    raise exception 'Task assignee must be an active member of the same firm';
  end if;
  return new;
end;
$$;

create or replace function public.crm_validate_opportunity_event_firm()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.crm_opportunities where id = new.opportunity_id and firm_id = new.firm_id) then
    raise exception 'Opportunity event must belong to the same firm as its opportunity';
  end if;
  return new;
end;
$$;

create or replace function public.crm_validate_task_event_firm()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.crm_tasks where id = new.task_id and firm_id = new.firm_id) then
    raise exception 'Task event must belong to the same firm as its task';
  end if;
  return new;
end;
$$;

drop trigger if exists crm_opportunities_validate_firm on public.crm_opportunities;
create trigger crm_opportunities_validate_firm before insert or update on public.crm_opportunities for each row execute function public.crm_validate_opportunity_firm();
drop trigger if exists crm_tasks_validate_firm on public.crm_tasks;
create trigger crm_tasks_validate_firm before insert or update on public.crm_tasks for each row execute function public.crm_validate_task_firm();
drop trigger if exists crm_opportunity_events_validate_firm on public.crm_opportunity_events;
create trigger crm_opportunity_events_validate_firm before insert on public.crm_opportunity_events for each row execute function public.crm_validate_opportunity_event_firm();
drop trigger if exists crm_task_events_validate_firm on public.crm_task_events;
create trigger crm_task_events_validate_firm before insert on public.crm_task_events for each row execute function public.crm_validate_task_event_firm();

create index if not exists crm_firm_members_user_idx on public.crm_firm_members (user_id, firm_id) where status = 'active';
create index if not exists crm_contacts_created_by_idx on public.crm_contacts (created_by) where created_by is not null;
create index if not exists crm_contacts_updated_by_idx on public.crm_contacts (updated_by) where updated_by is not null;
create index if not exists crm_opportunities_assigned_to_idx on public.crm_opportunities (assigned_to) where assigned_to is not null;
create index if not exists crm_opportunities_created_by_idx on public.crm_opportunities (created_by) where created_by is not null;
create index if not exists crm_opportunities_updated_by_idx on public.crm_opportunities (updated_by) where updated_by is not null;
create index if not exists crm_opportunity_events_firm_idx on public.crm_opportunity_events (firm_id, created_at desc);
create index if not exists crm_opportunity_events_actor_idx on public.crm_opportunity_events (actor_id) where actor_id is not null;
create index if not exists crm_tasks_assigned_to_idx on public.crm_tasks (assigned_to) where assigned_to is not null;
create index if not exists crm_tasks_created_by_idx on public.crm_tasks (created_by) where created_by is not null;
create index if not exists crm_tasks_updated_by_idx on public.crm_tasks (updated_by) where updated_by is not null;
create index if not exists crm_tasks_firm_status_due_idx on public.crm_tasks (firm_id, status, due_on);
create index if not exists crm_task_events_firm_idx on public.crm_task_events (firm_id, created_at desc);
create index if not exists crm_task_events_actor_idx on public.crm_task_events (actor_id) where actor_id is not null;