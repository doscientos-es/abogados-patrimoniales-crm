-- Legacy columns remain mandatory while the newer category/original_name
-- contract is in use, so versions must populate both representations.
create or replace function public.crm_create_document_version(
  target_document_id uuid, target_expected_version integer, original_file_name text,
  content_mime_type text, content_size_bytes bigint
)
returns public.crm_case_documents language plpgsql security definer set search_path = public as $$
declare current_document public.crm_case_documents; document_id uuid := gen_random_uuid(); created_document public.crm_case_documents;
begin
  if auth.uid() is null then raise exception 'Forbidden'; end if;
  select * into current_document from public.crm_case_documents
  where id = target_document_id and is_current and archived_at is null for update;
  if not found or not public.crm_can_read_case_document(current_document.storage_path) then
    raise exception 'Document not found';
  end if;
  if current_document.version <> target_expected_version then
    raise exception 'Document changed by another user; reload before uploading' using errcode = '40001';
  end if;
  if current_document.content_status <> 'validated' then raise exception 'Current document is not finalized'; end if;
  if nullif(trim(original_file_name), '') is null or char_length(trim(original_file_name)) > 500
    or content_size_bytes < 1 or content_size_bytes > 26214400 then raise exception 'Invalid file'; end if;
  if content_mime_type not in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/jpeg','image/png') then raise exception 'Unsupported file type'; end if;
  update public.crm_case_documents set is_current = false where id = current_document.id;
  insert into public.crm_case_documents(id,firm_id,case_id,workstream_id,folder_id,name,document_type,logical_document_id,previous_version_id,version,category,original_name,storage_path,mime_type,size_bytes,confidentiality,content_status,is_current)
  values(document_id,current_document.firm_id,current_document.case_id,current_document.workstream_id,current_document.folder_id,trim(original_file_name),current_document.category,current_document.logical_document_id,current_document.id,current_document.version+1,current_document.category,trim(original_file_name),current_document.firm_id::text||'/'||current_document.case_id::text||'/'||current_document.logical_document_id::text||'/'||(current_document.version+1)::text||'/'||document_id::text,content_mime_type,content_size_bytes,current_document.confidentiality,'pending',true)
  returning * into created_document;
  return created_document;
end;
$$;

revoke all on function public.crm_create_document_version(uuid, integer, text, text, bigint) from public, anon;
grant execute on function public.crm_create_document_version(uuid, integer, text, text, bigint) to authenticated;

notify pgrst, 'reload schema';