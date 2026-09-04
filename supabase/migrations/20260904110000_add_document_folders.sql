-- Folder metadata is kept separate from private Storage paths, so a move never
-- duplicates or exposes an uploaded object and remains compatible with a sync provider.
create table public.crm_document_folders (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  case_id uuid not null,
  parent_id uuid references public.crm_document_folders(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  created_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (firm_id, case_id, parent_id, name),
  foreign key (firm_id, case_id) references public.crm_cases(firm_id, id) on delete cascade
);

alter table public.crm_document_folders enable row level security;
create policy crm_document_folders_read on public.crm_document_folders
  for select to authenticated using (public.crm_is_firm_member(firm_id));
grant select on public.crm_document_folders to authenticated;
create index crm_document_folders_case_parent_idx
  on public.crm_document_folders(firm_id, case_id, parent_id, name);

alter table public.crm_case_documents
  add column folder_id uuid references public.crm_document_folders(id) on delete set null;
create index crm_case_documents_folder_idx
  on public.crm_case_documents(firm_id, case_id, folder_id)
  where is_current and archived_at is null;

create or replace function public.crm_touch_document_folder()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger crm_document_folders_touch
  before update on public.crm_document_folders
  for each row execute procedure public.crm_touch_document_folder();

create or replace function public.crm_create_document_folder(
  target_firm_id uuid, target_case_id uuid, target_parent_id uuid, folder_name text
)
returns public.crm_document_folders language plpgsql security definer set search_path = public as $$
declare parent_folder public.crm_document_folders; created_folder public.crm_document_folders;
begin
  if auth.uid() is null or not public.crm_is_firm_member(target_firm_id) then
    raise exception 'Forbidden';
  end if;
  if not exists (select 1 from public.crm_cases where id = target_case_id and firm_id = target_firm_id) then
    raise exception 'Case not found';
  end if;
  if nullif(trim(folder_name), '') is null or char_length(trim(folder_name)) > 160 then
    raise exception 'Invalid folder name';
  end if;
  if target_parent_id is not null then
    select * into parent_folder from public.crm_document_folders where id = target_parent_id;
    if not found or parent_folder.firm_id <> target_firm_id or parent_folder.case_id <> target_case_id then
      raise exception 'Parent folder not found';
    end if;
  end if;
  insert into public.crm_document_folders(firm_id, case_id, parent_id, name, created_by)
  values (target_firm_id, target_case_id, target_parent_id, trim(folder_name), auth.uid())
  returning * into created_folder;
  return created_folder;
end;
$$;

create or replace function public.crm_move_case_document(
  target_document_id uuid, target_folder_id uuid
)
returns public.crm_case_documents language plpgsql security definer set search_path = public as $$
declare current_document public.crm_case_documents; target_folder public.crm_document_folders;
begin
  if auth.uid() is null then raise exception 'Forbidden'; end if;
  select * into current_document from public.crm_case_documents
  where id = target_document_id and is_current and archived_at is null for update;
  if not found or not public.crm_can_read_case_document(current_document.storage_path) then
    raise exception 'Document not found';
  end if;
  if target_folder_id is not null then
    select * into target_folder from public.crm_document_folders where id = target_folder_id;
    if not found or target_folder.firm_id <> current_document.firm_id
      or target_folder.case_id <> current_document.case_id then
      raise exception 'Folder not found';
    end if;
  end if;
  update public.crm_case_documents set folder_id = target_folder_id where id = current_document.id;
  select * into current_document from public.crm_case_documents where id = current_document.id;
  return current_document;
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
  insert into public.crm_case_documents(id,firm_id,case_id,workstream_id,folder_id,logical_document_id,previous_version_id,version,category,original_name,storage_path,mime_type,size_bytes,confidentiality,content_status,is_current)
  values(document_id,current_document.firm_id,current_document.case_id,current_document.workstream_id,current_document.folder_id,current_document.logical_document_id,current_document.id,current_document.version+1,current_document.category,trim(original_file_name),current_document.firm_id::text||'/'||current_document.case_id::text||'/'||current_document.logical_document_id::text||'/'||(current_document.version+1)::text||'/'||document_id::text,content_mime_type,content_size_bytes,current_document.confidentiality,'pending',true)
  returning * into created_document;
  return created_document;
end;
$$;

revoke all on function public.crm_create_document_folder(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.crm_create_document_folder(uuid, uuid, uuid, text) to authenticated;
revoke all on function public.crm_move_case_document(uuid, uuid) from public, anon;
grant execute on function public.crm_move_case_document(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
