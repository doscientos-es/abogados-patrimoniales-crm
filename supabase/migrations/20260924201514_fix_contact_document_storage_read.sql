drop policy if exists crm_contact_documents_storage_select on storage.objects;

create policy crm_contact_documents_storage_select on storage.objects
  for select to authenticated using (
    bucket_id = 'contact-documents'
    and exists (
      select 1
      from public.crm_contact_documents d
      join public.crm_firm_members m on m.firm_id = d.firm_id
      where d.storage_path = objects.name
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and m.role in ('owner', 'admin', 'lawyer')
    )
  );