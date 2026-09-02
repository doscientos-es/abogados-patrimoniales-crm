-- Avoid evaluating write policies during reads and cover the AI document session foreign key.
drop policy crm_note_contacts_write on public.crm_note_contacts;
create policy crm_note_contacts_create on public.crm_note_contacts
  for insert to authenticated
  with check (
    exists (
      select 1 from public.crm_notes
      where id = note_id
        and (created_by = (select auth.uid()) or public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]))
    )
  );
create policy crm_note_contacts_update on public.crm_note_contacts
  for update to authenticated
  using (
    exists (
      select 1 from public.crm_notes
      where id = note_id
        and (created_by = (select auth.uid()) or public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]))
    )
  )
  with check (
    exists (
      select 1 from public.crm_notes
      where id = note_id
        and (created_by = (select auth.uid()) or public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]))
    )
  );
create policy crm_note_contacts_delete on public.crm_note_contacts
  for delete to authenticated
  using (
    exists (
      select 1 from public.crm_notes
      where id = note_id
        and (created_by = (select auth.uid()) or public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]))
    )
  );

drop policy crm_note_permissions_write on public.crm_note_permissions;
create policy crm_note_permissions_create on public.crm_note_permissions
  for insert to authenticated
  with check (
    exists (
      select 1 from public.crm_notes
      where id = note_id
        and (created_by = (select auth.uid()) or public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]))
    )
  );
create policy crm_note_permissions_update on public.crm_note_permissions
  for update to authenticated
  using (
    exists (
      select 1 from public.crm_notes
      where id = note_id
        and (created_by = (select auth.uid()) or public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]))
    )
  )
  with check (
    exists (
      select 1 from public.crm_notes
      where id = note_id
        and (created_by = (select auth.uid()) or public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]))
    )
  );
create policy crm_note_permissions_delete on public.crm_note_permissions
  for delete to authenticated
  using (
    exists (
      select 1 from public.crm_notes
      where id = note_id
        and (created_by = (select auth.uid()) or public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]))
    )
  );

create index crm_ai_intake_documents_firm_session_idx
  on public.crm_ai_intake_documents (firm_id, session_id);