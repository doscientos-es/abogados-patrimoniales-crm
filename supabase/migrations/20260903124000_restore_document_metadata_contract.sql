-- The versioned-document RPCs use these canonical names while legacy records
-- retain name/document_type for backwards compatibility.
alter table public.crm_case_documents
  add column if not exists category text,
  add column if not exists original_name text;
update public.crm_case_documents
set category = coalesce(nullif(category, ''), nullif(document_type, ''), 'General'),
    original_name = coalesce(nullif(original_name, ''), nullif(name, ''), 'Documento')
where category is null or original_name is null or category = '' or original_name = '';
alter table public.crm_case_documents
  alter column category set default 'General',
  alter column category set not null,
  alter column original_name set not null;

create or replace function public.crm_create_case_document(
  target_firm_id uuid, target_case_id uuid, target_workstream_id uuid,
  document_category text, original_file_name text, content_mime_type text,
  content_size_bytes bigint, document_confidentiality text
)
returns public.crm_case_documents language plpgsql security definer set search_path = public as $$
declare document_id uuid := gen_random_uuid(); created_document public.crm_case_documents;
begin
  if auth.uid() is null or not public.crm_is_firm_member(target_firm_id) then raise exception 'Forbidden'; end if;
  if not exists (select 1 from public.crm_cases where id = target_case_id and firm_id = target_firm_id) then raise exception 'Case not found'; end if;
  if target_workstream_id is not null and not exists (select 1 from public.crm_case_workstreams where id = target_workstream_id and case_id = target_case_id and firm_id = target_firm_id) then raise exception 'Workstream not found'; end if;
  if nullif(trim(original_file_name), '') is null or char_length(trim(original_file_name)) > 500 or content_size_bytes < 1 or content_size_bytes > 26214400 then raise exception 'Invalid file'; end if;
  if content_mime_type not in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/jpeg','image/png') then raise exception 'Unsupported file type'; end if;
  if document_confidentiality not in ('normal','restricted','confidential') then raise exception 'Invalid confidentiality'; end if;
  insert into public.crm_case_documents(id, firm_id, case_id, workstream_id, name, document_type, logical_document_id, version, category, original_name, storage_path, mime_type, size_bytes, confidentiality, content_status, is_current)
  values(document_id, target_firm_id, target_case_id, target_workstream_id, trim(original_file_name), trim(document_category), document_id, 1, trim(document_category), trim(original_file_name), target_firm_id::text||'/'||target_case_id::text||'/'||document_id::text||'/1/'||document_id::text, content_mime_type, content_size_bytes, document_confidentiality, 'pending', true)
  returning * into created_document;
  return created_document;
end;
$$;

create or replace function public.crm_create_document_version(
  target_document_id uuid, target_expected_version integer, original_file_name text,
  content_mime_type text, content_size_bytes bigint
)
returns public.crm_case_documents language plpgsql security definer set search_path = public as $$
declare current_document public.crm_case_documents; document_id uuid := gen_random_uuid(); created_document public.crm_case_documents;
begin
  if auth.uid() is null then raise exception 'Forbidden'; end if;
  select * into current_document from public.crm_case_documents where id = target_document_id and is_current and archived_at is null for update;
  if not found or not public.crm_can_read_case_document(current_document.storage_path) then raise exception 'Document not found'; end if;
  if current_document.version <> target_expected_version then raise exception 'Document changed by another user; reload before uploading' using errcode = '40001'; end if;
  if current_document.content_status <> 'validated' then raise exception 'Current document is not finalized'; end if;
  if nullif(trim(original_file_name), '') is null or char_length(trim(original_file_name)) > 500 or content_size_bytes < 1 or content_size_bytes > 26214400 then raise exception 'Invalid file'; end if;
  if content_mime_type not in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/jpeg','image/png') then raise exception 'Unsupported file type'; end if;
  update public.crm_case_documents set is_current = false where id = current_document.id;
  insert into public.crm_case_documents(id, firm_id, case_id, workstream_id, name, document_type, logical_document_id, previous_version_id, version, category, original_name, storage_path, mime_type, size_bytes, confidentiality, content_status, is_current)
  values(document_id, current_document.firm_id, current_document.case_id, current_document.workstream_id, trim(original_file_name), current_document.category, current_document.logical_document_id, current_document.id, current_document.version + 1, current_document.category, trim(original_file_name), current_document.firm_id::text||'/'||current_document.case_id::text||'/'||current_document.logical_document_id::text||'/'||(current_document.version + 1)::text||'/'||document_id::text, content_mime_type, content_size_bytes, current_document.confidentiality, 'pending', true)
  returning * into created_document;
  return created_document;
end;
$$;