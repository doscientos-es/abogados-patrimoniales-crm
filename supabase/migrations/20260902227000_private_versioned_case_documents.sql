alter table public.crm_case_documents
  add column logical_document_id uuid,
  add column previous_version_id uuid references public.crm_case_documents(id) on delete restrict,
  add column checksum_sha256 text,
  add column content_status text not null default 'pending'
    check (content_status in ('pending', 'validated', 'rejected')),
  add column is_current boolean not null default true,
  add column archived_at timestamptz,
  add column archived_by uuid references public.crm_profiles(id) on delete set null;

update public.crm_case_documents set logical_document_id = id where logical_document_id is null;
alter table public.crm_case_documents
  alter column logical_document_id set not null,
  add constraint crm_case_documents_logical_fk foreign key (logical_document_id)
    references public.crm_case_documents(id) on delete restrict,
  add constraint crm_case_documents_checksum_check check (
    checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$'
  ),
  add constraint crm_case_documents_version_unique unique (firm_id, logical_document_id, version);

create unique index crm_case_documents_one_current_idx
  on public.crm_case_documents(firm_id, logical_document_id)
  where is_current and archived_at is null;

create or replace function public.crm_can_read_case_document(target_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.crm_case_documents d
    join public.crm_firm_members m on m.firm_id = d.firm_id
      and m.user_id = auth.uid() and m.status = 'active'
    left join public.crm_cases c on c.id = d.case_id and c.firm_id = d.firm_id
    where d.storage_path = target_path and d.archived_at is null and d.content_status <> 'rejected'
      and (
        d.confidentiality = 'normal'
        or (d.confidentiality = 'restricted' and m.role in ('owner', 'admin', 'lawyer'))
        or (d.confidentiality = 'confidential' and (
          m.role in ('owner', 'admin') or d.created_by = auth.uid() or c.assigned_to = auth.uid()
        ))
      )
  );
$$;

create or replace function public.crm_can_write_case_document(target_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.crm_case_documents d
    join public.crm_firm_members m on m.firm_id = d.firm_id
      and m.user_id = auth.uid() and m.status = 'active'
    where d.storage_path = target_path and d.archived_at is null
      and (d.created_by = auth.uid() or m.role in ('owner', 'admin'))
  );
$$;

revoke all on function public.crm_can_read_case_document(text) from public, anon;
grant execute on function public.crm_can_read_case_document(text) to authenticated;
revoke all on function public.crm_can_write_case_document(text) from public, anon;
grant execute on function public.crm_can_write_case_document(text) to authenticated;

drop policy if exists crm_case_documents_read on public.crm_case_documents;
create policy crm_case_documents_read on public.crm_case_documents for select to authenticated
using (public.crm_can_read_case_document(storage_path));

drop policy if exists crm_case_documents_storage_read on storage.objects;
drop policy if exists crm_case_documents_storage_insert on storage.objects;
drop policy if exists crm_case_documents_storage_update on storage.objects;
drop policy if exists crm_case_documents_storage_delete on storage.objects;
create policy crm_case_documents_storage_read on storage.objects for select to authenticated
using (bucket_id = 'case-documents' and public.crm_can_read_case_document(name));
create policy crm_case_documents_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'case-documents' and public.crm_can_write_case_document(name));
create policy crm_case_documents_storage_update on storage.objects for update to authenticated
using (bucket_id = 'case-documents' and public.crm_can_write_case_document(name))
with check (bucket_id = 'case-documents' and public.crm_can_write_case_document(name));
create policy crm_case_documents_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'case-documents' and public.crm_can_write_case_document(name));