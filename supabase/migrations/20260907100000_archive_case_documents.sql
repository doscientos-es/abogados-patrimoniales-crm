-- Archive all versions of a logical document without deleting its private
-- content. Access is revoked immediately; owner/admin audit remains available.
create table public.crm_case_document_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  case_id uuid references public.crm_cases(id) on delete cascade,
  document_id uuid not null references public.crm_case_documents(id) on delete restrict,
  logical_document_id uuid not null references public.crm_case_documents(id) on delete restrict,
  event_type text not null check (event_type in ('archived')),
  actor_id uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.crm_case_document_events enable row level security;
create policy crm_case_document_events_read on public.crm_case_document_events
  for select to authenticated using (
    exists (
      select 1 from public.crm_firm_members m
      where m.firm_id = crm_case_document_events.firm_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role in ('owner', 'admin')
    )
  );
grant select on public.crm_case_document_events to authenticated;

create index crm_case_document_events_document_created_idx
  on public.crm_case_document_events(firm_id, document_id, created_at desc);

create or replace function public.crm_archive_case_document(
  target_document_id uuid, target_expected_version integer
)
returns public.crm_case_documents language plpgsql security definer set search_path = public as $$
declare
  current_document public.crm_case_documents;
  archived_document public.crm_case_documents;
begin
  if auth.uid() is null then raise exception 'Forbidden'; end if;
  if target_expected_version is null or target_expected_version < 1 then
    raise exception 'A valid expected version is required';
  end if;
  select * into current_document from public.crm_case_documents
  where id = target_document_id and is_current and archived_at is null for update;
  if not found or not public.crm_can_write_case_document(current_document.storage_path) then
    raise exception 'Document not found';
  end if;
  if current_document.version <> target_expected_version then
    raise exception 'Document changed by another user; reload before archiving' using errcode = '40001';
  end if;

  update public.crm_case_documents
  set archived_at = now(), archived_by = auth.uid(), is_current = false
  where firm_id = current_document.firm_id
    and logical_document_id = current_document.logical_document_id
    and archived_at is null;
  select * into archived_document from public.crm_case_documents where id = current_document.id;

  insert into public.crm_case_document_events(
    firm_id, case_id, document_id, logical_document_id, event_type, actor_id
  ) values (
    current_document.firm_id, current_document.case_id, current_document.id,
    current_document.logical_document_id, 'archived', auth.uid()
  );
  return archived_document;
end;
$$;

revoke all on function public.crm_archive_case_document(uuid, integer) from public, anon;
grant execute on function public.crm_archive_case_document(uuid, integer) to authenticated;
notify pgrst, 'reload schema';