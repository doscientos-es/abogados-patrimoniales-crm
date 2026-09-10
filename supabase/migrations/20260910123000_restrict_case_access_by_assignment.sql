-- Firm owners/admins can supervise every matter. Other members only see
-- matters assigned to them; this is the access model agreed for external lawyers.
create or replace function public.crm_can_access_case(target_case_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.crm_cases c
    join public.crm_firm_members m on m.firm_id = c.firm_id
    where c.id = target_case_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and (
        m.role in ('owner', 'admin')
        or c.assigned_to = (select auth.uid())
        or c.created_by = (select auth.uid())
      )
  );
$$;

revoke all on function public.crm_can_access_case(uuid) from public, anon;
grant execute on function public.crm_can_access_case(uuid) to authenticated;

drop policy if exists crm_cases_member on public.crm_cases;
create policy crm_cases_read on public.crm_cases for select to authenticated
  using (public.crm_can_access_case(id));
create policy crm_cases_create on public.crm_cases for insert to authenticated
  with check (
    public.crm_is_firm_member(firm_id)
    and (assigned_to = (select auth.uid()) or public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]))
  );
create policy crm_cases_update on public.crm_cases for update to authenticated
  using (public.crm_can_access_case(id))
  with check (public.crm_can_access_case(id));

drop policy if exists crm_case_workstreams_member on public.crm_case_workstreams;
create policy crm_case_workstreams_access on public.crm_case_workstreams for all to authenticated
  using (public.crm_can_access_case(case_id)) with check (public.crm_can_access_case(case_id));
drop policy if exists crm_case_activities_member on public.crm_case_activities;
create policy crm_case_activities_access on public.crm_case_activities for all to authenticated
  using (public.crm_can_access_case(case_id)) with check (public.crm_can_access_case(case_id));
drop policy if exists crm_case_tasks_member on public.crm_case_tasks;
create policy crm_case_tasks_access on public.crm_case_tasks for all to authenticated
  using (public.crm_can_access_case(case_id)) with check (public.crm_can_access_case(case_id));
drop policy if exists crm_case_dates_member on public.crm_case_dates;
create policy crm_case_dates_access on public.crm_case_dates for all to authenticated
  using (public.crm_can_access_case(case_id)) with check (public.crm_can_access_case(case_id));
drop policy if exists crm_case_communications_member on public.crm_case_communications;
create policy crm_case_communications_access on public.crm_case_communications for all to authenticated
  using (public.crm_can_access_case(case_id)) with check (public.crm_can_access_case(case_id));
drop policy if exists crm_case_participants_member on public.crm_case_participants;
create policy crm_case_participants_access on public.crm_case_participants for all to authenticated
  using (public.crm_can_access_case(case_id)) with check (public.crm_can_access_case(case_id));

drop policy if exists crm_case_documents_read on public.crm_case_documents;
create policy crm_case_documents_read on public.crm_case_documents for select to authenticated
  using (case_id is null or public.crm_can_access_case(case_id));
