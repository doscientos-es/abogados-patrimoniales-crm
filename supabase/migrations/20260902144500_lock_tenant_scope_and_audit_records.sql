-- Client updates must never move a record across firms or rewrite its author.
create or replace function public.crm_reject_entity_scope_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.firm_id is distinct from old.firm_id then
    raise exception 'A record cannot be moved to another firm';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'The original record author cannot be changed';
  end if;
  return new;
end;
$$;

create or replace function public.crm_reject_firm_scope_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.firm_id is distinct from old.firm_id then
    raise exception 'A record cannot be moved to another firm';
  end if;
  return new;
end;
$$;

create trigger crm_contacts_scope_immutable before update on public.crm_contacts for each row execute function public.crm_reject_entity_scope_change();
create trigger crm_opportunities_scope_immutable before update on public.crm_opportunities for each row execute function public.crm_reject_entity_scope_change();
create trigger crm_tasks_scope_immutable before update on public.crm_tasks for each row execute function public.crm_reject_entity_scope_change();
create trigger crm_cases_scope_immutable before update on public.crm_cases for each row execute function public.crm_reject_entity_scope_change();
create trigger crm_case_workstreams_scope_immutable before update on public.crm_case_workstreams for each row execute function public.crm_reject_entity_scope_change();
create trigger crm_case_activities_scope_immutable before update on public.crm_case_activities for each row execute function public.crm_reject_entity_scope_change();
create trigger crm_case_documents_scope_immutable before update on public.crm_case_documents for each row execute function public.crm_reject_entity_scope_change();
create trigger crm_case_tasks_scope_immutable before update on public.crm_case_tasks for each row execute function public.crm_reject_entity_scope_change();
create trigger crm_case_dates_scope_immutable before update on public.crm_case_dates for each row execute function public.crm_reject_entity_scope_change();
create trigger crm_case_communications_scope_immutable before update on public.crm_case_communications for each row execute function public.crm_reject_entity_scope_change();
create trigger crm_onboardings_scope_immutable before update on public.crm_onboardings for each row execute function public.crm_reject_entity_scope_change();
create trigger crm_notes_scope_immutable before update on public.crm_notes for each row execute function public.crm_reject_entity_scope_change();
create trigger crm_ai_intake_sessions_scope_immutable before update on public.crm_ai_intake_sessions for each row execute function public.crm_reject_entity_scope_change();
create trigger crm_case_contacts_scope_immutable before update on public.crm_case_contacts for each row execute function public.crm_reject_firm_scope_change();
create trigger crm_case_participants_scope_immutable before update on public.crm_case_participants for each row execute function public.crm_reject_firm_scope_change();
create trigger crm_note_contacts_scope_immutable before update on public.crm_note_contacts for each row execute function public.crm_reject_firm_scope_change();
create trigger crm_note_permissions_scope_immutable before update on public.crm_note_permissions for each row execute function public.crm_reject_firm_scope_change();
create trigger crm_ai_intake_documents_scope_immutable before update on public.crm_ai_intake_documents for each row execute function public.crm_reject_firm_scope_change();

drop policy crm_cases_member on public.crm_cases;
drop policy crm_case_contacts_member on public.crm_case_contacts;
drop policy crm_case_workstreams_member on public.crm_case_workstreams;
drop policy crm_case_activities_member on public.crm_case_activities;
drop policy crm_case_documents_member on public.crm_case_documents;
drop policy crm_case_tasks_member on public.crm_case_tasks;
drop policy crm_case_dates_member on public.crm_case_dates;
drop policy crm_case_communications_member on public.crm_case_communications;
drop policy crm_case_participants_member on public.crm_case_participants;
drop policy crm_onboardings_member on public.crm_onboardings;
drop policy crm_ai_intake_sessions_member on public.crm_ai_intake_sessions;
drop policy crm_ai_intake_documents_member on public.crm_ai_intake_documents;

create policy crm_cases_read on public.crm_cases for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_cases_create on public.crm_cases for insert to authenticated with check (public.crm_is_firm_member(firm_id));
create policy crm_cases_update on public.crm_cases for update to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_case_contacts_read on public.crm_case_contacts for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_case_contacts_create on public.crm_case_contacts for insert to authenticated with check (public.crm_is_firm_member(firm_id));
create policy crm_case_contacts_update on public.crm_case_contacts for update to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_case_workstreams_read on public.crm_case_workstreams for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_case_workstreams_create on public.crm_case_workstreams for insert to authenticated with check (public.crm_is_firm_member(firm_id));
create policy crm_case_workstreams_update on public.crm_case_workstreams for update to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_case_activities_read on public.crm_case_activities for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_case_activities_create on public.crm_case_activities for insert to authenticated with check (public.crm_is_firm_member(firm_id));
create policy crm_case_activities_update on public.crm_case_activities for update to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_case_documents_read on public.crm_case_documents for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_case_documents_create on public.crm_case_documents for insert to authenticated with check (public.crm_is_firm_member(firm_id));
create policy crm_case_documents_update on public.crm_case_documents for update to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_case_tasks_read on public.crm_case_tasks for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_case_tasks_create on public.crm_case_tasks for insert to authenticated with check (public.crm_is_firm_member(firm_id));
create policy crm_case_tasks_update on public.crm_case_tasks for update to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_case_dates_read on public.crm_case_dates for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_case_dates_create on public.crm_case_dates for insert to authenticated with check (public.crm_is_firm_member(firm_id));
create policy crm_case_dates_update on public.crm_case_dates for update to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_case_communications_read on public.crm_case_communications for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_case_communications_create on public.crm_case_communications for insert to authenticated with check (public.crm_is_firm_member(firm_id));
create policy crm_case_communications_update on public.crm_case_communications for update to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_case_participants_read on public.crm_case_participants for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_case_participants_create on public.crm_case_participants for insert to authenticated with check (public.crm_is_firm_member(firm_id));
create policy crm_case_participants_update on public.crm_case_participants for update to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_onboardings_read on public.crm_onboardings for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_onboardings_create on public.crm_onboardings for insert to authenticated with check (public.crm_is_firm_member(firm_id));
create policy crm_onboardings_update on public.crm_onboardings for update to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_ai_intake_sessions_read on public.crm_ai_intake_sessions for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_ai_intake_sessions_create on public.crm_ai_intake_sessions for insert to authenticated with check (public.crm_is_firm_member(firm_id));
create policy crm_ai_intake_sessions_update on public.crm_ai_intake_sessions for update to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_ai_intake_documents_read on public.crm_ai_intake_documents for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_ai_intake_documents_create on public.crm_ai_intake_documents for insert to authenticated with check (public.crm_is_firm_member(firm_id));
create policy crm_ai_intake_documents_update on public.crm_ai_intake_documents for update to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));

revoke delete on public.crm_cases, public.crm_case_contacts, public.crm_case_workstreams, public.crm_case_activities, public.crm_case_documents, public.crm_case_tasks, public.crm_case_dates, public.crm_case_communications, public.crm_case_participants, public.crm_onboardings, public.crm_notes, public.crm_note_acknowledgements, public.crm_note_events, public.crm_ai_intake_sessions, public.crm_ai_intake_documents from authenticated;