-- Workflow state belongs to the logical document, independently of its folder
-- and file versions. Every historical version mirrors the current workflow state.
alter table public.crm_case_documents
  add column workflow_status text not null default 'inbox'
    check (workflow_status in ('inbox', 'in_progress', 'processed'));

create index crm_case_documents_workflow_idx
  on public.crm_case_documents (firm_id, workflow_status, created_at desc)
  where is_current and archived_at is null;

alter table public.crm_case_document_events
  add column previous_workflow_status text,
  add column workflow_status text;

alter table public.crm_case_document_events
  add constraint crm_case_document_events_previous_workflow_status_check
    check (previous_workflow_status is null or previous_workflow_status in ('inbox', 'in_progress', 'processed')),
  add constraint crm_case_document_events_workflow_status_check
    check (workflow_status is null or workflow_status in ('inbox', 'in_progress', 'processed'));

alter table public.crm_case_document_events
  drop constraint crm_case_document_events_event_type_check,
  add constraint crm_case_document_events_event_type_check
    check (event_type in ('archived', 'workflow_status_changed'));

create or replace function public.crm_update_document_workflow(
  target_document_id uuid,
  target_expected_version integer,
  target_workflow_status text
)
returns public.crm_case_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  current_document public.crm_case_documents;
  updated_document public.crm_case_documents;
begin
  if auth.uid() is null then raise exception 'Forbidden'; end if;
  if target_expected_version is null or target_expected_version < 1 then
    raise exception 'A valid expected version is required';
  end if;
  if target_workflow_status not in ('inbox', 'in_progress', 'processed') then
    raise exception 'Invalid workflow status';
  end if;

  select * into current_document
  from public.crm_case_documents
  where id = target_document_id and is_current and archived_at is null
  for update;
  if not found or not public.crm_can_read_case_document(current_document.storage_path) then
    raise exception 'Document not found';
  end if;
  if current_document.version <> target_expected_version then
    raise exception 'Document changed by another user; reload before changing workflow' using errcode = '40001';
  end if;
  if current_document.workflow_status = target_workflow_status then
    return current_document;
  end if;

  update public.crm_case_documents
  set workflow_status = target_workflow_status, updated_at = now()
  where firm_id = current_document.firm_id
    and logical_document_id = current_document.logical_document_id
    and archived_at is null;
  select * into updated_document from public.crm_case_documents where id = current_document.id;

  insert into public.crm_case_document_events(
    firm_id, case_id, document_id, logical_document_id, event_type,
    previous_workflow_status, workflow_status, actor_id
  ) values (
    current_document.firm_id, current_document.case_id, current_document.id,
    current_document.logical_document_id, 'workflow_status_changed',
    current_document.workflow_status, target_workflow_status, auth.uid()
  );
  return updated_document;
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
  select * into current_document from public.crm_case_documents
  where id = target_document_id and is_current and archived_at is null for update;
  if not found or not public.crm_can_read_case_document(current_document.storage_path) then raise exception 'Document not found'; end if;
  if current_document.version <> target_expected_version then
    raise exception 'Document changed by another user; reload before uploading' using errcode = '40001';
  end if;
  if current_document.content_status <> 'validated' then raise exception 'Current document is not finalized'; end if;
  if nullif(trim(original_file_name), '') is null or char_length(trim(original_file_name)) > 500
    or content_size_bytes < 1 or content_size_bytes > 26214400 then raise exception 'Invalid file'; end if;
  if content_mime_type not in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/jpeg','image/png') then raise exception 'Unsupported file type'; end if;
  update public.crm_case_documents set is_current = false where id = current_document.id;
  insert into public.crm_case_documents(id,firm_id,case_id,workstream_id,folder_id,name,document_type,logical_document_id,previous_version_id,version,category,original_name,storage_path,mime_type,size_bytes,confidentiality,content_status,workflow_status,is_current)
  values(document_id,current_document.firm_id,current_document.case_id,current_document.workstream_id,current_document.folder_id,trim(original_file_name),current_document.category,current_document.logical_document_id,current_document.id,current_document.version+1,current_document.category,trim(original_file_name),current_document.firm_id::text||'/'||current_document.case_id::text||'/'||current_document.logical_document_id::text||'/'||(current_document.version+1)::text||'/'||document_id::text,content_mime_type,content_size_bytes,current_document.confidentiality,'pending',current_document.workflow_status,true)
  returning * into created_document;
  return created_document;
end;
$$;

revoke all on function public.crm_update_document_workflow(uuid, integer, text) from public, anon;
grant execute on function public.crm_update_document_workflow(uuid, integer, text) to authenticated;
notify pgrst, 'reload schema';