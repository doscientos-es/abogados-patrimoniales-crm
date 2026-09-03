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
  if nullif(trim(original_file_name), '') is null or content_size_bytes < 1 or content_size_bytes > 26214400 then raise exception 'Invalid file'; end if;
  if content_mime_type not in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/jpeg','image/png') then raise exception 'Unsupported file type'; end if;
  if document_confidentiality not in ('normal','restricted','confidential') then raise exception 'Invalid confidentiality'; end if;
  insert into public.crm_case_documents(id, firm_id, case_id, workstream_id, logical_document_id, version, category, original_name, storage_path, mime_type, size_bytes, confidentiality, content_status, is_current)
  values(document_id, target_firm_id, target_case_id, target_workstream_id, document_id, 1, trim(document_category), trim(original_file_name), target_firm_id::text||'/'||target_case_id::text||'/'||document_id::text||'/1/'||document_id::text, content_mime_type, content_size_bytes, document_confidentiality, 'pending', true)
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
  select * into current_document from public.crm_case_documents where id = target_document_id and is_current and archived_at is null for update;
  if not found or not public.crm_is_firm_member(current_document.firm_id) then raise exception 'Document not found'; end if;
  if current_document.version <> target_expected_version then raise exception 'Document changed by another user; reload before uploading' using errcode = '40001'; end if;
  if current_document.content_status <> 'validated' then raise exception 'Current document is not finalized'; end if;
  if nullif(trim(original_file_name), '') is null or content_size_bytes < 1 or content_size_bytes > 26214400 then raise exception 'Invalid file'; end if;
  if content_mime_type not in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/jpeg','image/png') then raise exception 'Unsupported file type'; end if;
  update public.crm_case_documents set is_current = false where id = current_document.id;
  insert into public.crm_case_documents(id, firm_id, case_id, workstream_id, logical_document_id, previous_version_id, version, category, original_name, storage_path, mime_type, size_bytes, confidentiality, content_status, is_current)
  values(document_id, current_document.firm_id, current_document.case_id, current_document.workstream_id, current_document.logical_document_id, current_document.id, current_document.version + 1, current_document.category, trim(original_file_name), current_document.firm_id::text||'/'||current_document.case_id::text||'/'||current_document.logical_document_id::text||'/'||(current_document.version + 1)::text||'/'||document_id::text, content_mime_type, content_size_bytes, current_document.confidentiality, 'pending', true)
  returning * into created_document;
  return created_document;
end;
$$;

create or replace function public.crm_finalize_document_version(target_document_id uuid, content_checksum text)
returns public.crm_case_documents language plpgsql security definer set search_path = public as $$
declare updated_document public.crm_case_documents;
begin
  if content_checksum !~ '^[a-f0-9]{64}$' then raise exception 'Invalid checksum'; end if;
  update public.crm_case_documents set checksum_sha256 = content_checksum, content_status = 'validated'
  where id = target_document_id and content_status = 'pending' and created_by = auth.uid()
    and public.crm_is_firm_member(firm_id) returning * into updated_document;
  if not found then raise exception 'Pending document not found'; end if;
  return updated_document;
end;
$$;

create or replace function public.crm_abort_document_version(target_document_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pending_document public.crm_case_documents;
begin
  select * into pending_document from public.crm_case_documents where id = target_document_id and content_status = 'pending' for update;
  if not found or pending_document.created_by <> auth.uid() or not public.crm_is_firm_member(pending_document.firm_id) then raise exception 'Pending document not found'; end if;
  delete from public.crm_case_documents where id = pending_document.id;
  if pending_document.previous_version_id is not null then update public.crm_case_documents set is_current = true where id = pending_document.previous_version_id; end if;
end;
$$;

create or replace function public.crm_can_read_case_document(target_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crm_case_documents d join public.crm_firm_members m on m.firm_id=d.firm_id and m.user_id=auth.uid() and m.status='active' left join public.crm_cases c on c.id=d.case_id and c.firm_id=d.firm_id where d.storage_path=target_path and d.archived_at is null and d.content_status='validated' and (d.confidentiality='normal' or (d.confidentiality='restricted' and m.role in ('owner','admin','lawyer')) or (d.confidentiality='confidential' and (m.role in ('owner','admin') or d.created_by=auth.uid() or c.assigned_to=auth.uid()))));
$$;

revoke all on function public.crm_create_case_document(uuid,uuid,uuid,text,text,text,bigint,text) from public,anon;
grant execute on function public.crm_create_case_document(uuid,uuid,uuid,text,text,text,bigint,text) to authenticated;
revoke all on function public.crm_create_document_version(uuid,integer,text,text,bigint) from public,anon;
grant execute on function public.crm_create_document_version(uuid,integer,text,text,bigint) to authenticated;
revoke all on function public.crm_finalize_document_version(uuid,text) from public,anon;
grant execute on function public.crm_finalize_document_version(uuid,text) to authenticated;
revoke all on function public.crm_abort_document_version(uuid) from public,anon;
grant execute on function public.crm_abort_document_version(uuid) to authenticated;