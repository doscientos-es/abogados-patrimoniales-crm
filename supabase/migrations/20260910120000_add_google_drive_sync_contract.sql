-- Google Drive is an operational mirror of the CRM document store.
-- OAuth secrets stay in the Edge Function environment, never in public tables.
alter table public.crm_case_documents
  add column if not exists drive_file_id text,
  add column if not exists drive_parent_id text,
  add column if not exists drive_sync_status text not null default 'not_configured'
    check (drive_sync_status in ('not_configured', 'pending', 'synced', 'error')),
  add column if not exists drive_synced_at timestamptz,
  add column if not exists drive_error text;
alter table public.crm_cases add column if not exists drive_folder_id text;
alter table public.crm_document_folders add column if not exists drive_folder_id text;

create index if not exists crm_case_documents_drive_file_idx
  on public.crm_case_documents (firm_id, drive_file_id)
  where drive_file_id is not null;

create table if not exists public.crm_drive_connections (
  firm_id uuid primary key references public.crm_firms(id) on delete cascade,
  root_folder_id text not null default '',
  root_folder_name text not null default 'LEX · Expedientes',
  status text not null default 'disconnected'
    check (status in ('disconnected', 'connected', 'error')),
  last_sync_at timestamptz,
  last_error text,
  connected_at timestamptz,
  connected_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_drive_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  document_id uuid references public.crm_case_documents(id) on delete cascade,
  operation text not null check (operation in ('upload', 'move', 'archive')),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'error')),
  attempts integer not null default 0 check (attempts >= 0),
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.crm_drive_connections enable row level security;
alter table public.crm_drive_sync_jobs enable row level security;

drop policy if exists crm_drive_connections_read on public.crm_drive_connections;
create policy crm_drive_connections_read on public.crm_drive_connections
  for select to authenticated using (public.crm_is_firm_member(firm_id));

drop policy if exists crm_drive_connections_manage on public.crm_drive_connections;
create policy crm_drive_connections_manage on public.crm_drive_connections
  for all to authenticated
  using (public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]))
  with check (public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]));

drop policy if exists crm_drive_sync_jobs_read on public.crm_drive_sync_jobs;
create policy crm_drive_sync_jobs_read on public.crm_drive_sync_jobs
  for select to authenticated using (public.crm_is_firm_member(firm_id));

revoke all on public.crm_drive_connections, public.crm_drive_sync_jobs from anon;
grant select, insert, update, delete on public.crm_drive_connections, public.crm_drive_sync_jobs to authenticated;

create or replace function public.crm_queue_drive_sync(
  target_document_id uuid,
  target_operation text
)
returns public.crm_drive_sync_jobs
language plpgsql
security invoker
set search_path = public
as $$
declare
  document_row public.crm_case_documents;
  queued public.crm_drive_sync_jobs;
begin
  select * into document_row
  from public.crm_case_documents
  where id = target_document_id and public.crm_is_firm_member(firm_id);
  if not found then raise exception 'Document not found'; end if;
  if target_operation not in ('upload', 'move', 'archive') then raise exception 'Invalid Drive operation'; end if;
  update public.crm_case_documents
    set drive_sync_status = 'pending', drive_error = null, updated_at = now()
    where id = target_document_id;
  insert into public.crm_drive_sync_jobs (firm_id, document_id, operation)
    values (document_row.firm_id, document_row.id, target_operation)
    returning * into queued;
  return queued;
end;
$$;

revoke all on function public.crm_queue_drive_sync(uuid, text) from public, anon;
grant execute on function public.crm_queue_drive_sync(uuid, text) to authenticated;
