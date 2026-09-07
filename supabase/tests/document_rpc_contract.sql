-- Run with a database-administrator connection. Every fixture is rolled back.
begin;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'document-rpc@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now());
insert into public.crm_firms (id, name) values ('10000000-0000-4000-8000-0000000000c1', 'Document RPC Audit Firm');
insert into public.crm_firm_members (firm_id, user_id, role, status)
values ('10000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000c1', 'owner', 'active');
insert into public.crm_contacts (id, firm_id, nature, relationship, display_name)
values ('20000000-0000-4000-8000-0000000000c1', '10000000-0000-4000-8000-0000000000c1', 'person', 'client', 'Document RPC Contact');
insert into public.crm_cases (id, firm_id, case_number, primary_contact_id, title, nature)
values ('30000000-0000-4000-8000-0000000000c1', '10000000-0000-4000-8000-0000000000c1', 900001, '20000000-0000-4000-8000-0000000000c1', 'Document RPC Case', 'judicial');
insert into public.crm_cases (id, firm_id, case_number, primary_contact_id, title, nature)
values ('30000000-0000-4000-8000-0000000000c2', '10000000-0000-4000-8000-0000000000c1', 900002, '20000000-0000-4000-8000-0000000000c1', 'Other Document RPC Case', 'judicial');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
do $$
declare first_document public.crm_case_documents; second_document public.crm_case_documents;
  archived_document public.crm_case_documents;
  root_folder public.crm_document_folders; nested_folder public.crm_document_folders;
  other_case_folder public.crm_document_folders;
begin
  select * into first_document from public.crm_create_case_document(
    '10000000-0000-4000-8000-0000000000c1', '30000000-0000-4000-8000-0000000000c1', null,
    'General', 'contrato.pdf', 'application/pdf', 1, 'normal');
  perform public.crm_finalize_document_version(first_document.id, repeat('a', 64));
  select * into root_folder from public.crm_create_document_folder(
    '10000000-0000-4000-8000-0000000000c1', '30000000-0000-4000-8000-0000000000c1', null,
    'Escritos');
  select * into nested_folder from public.crm_create_document_folder(
    '10000000-0000-4000-8000-0000000000c1', '30000000-0000-4000-8000-0000000000c1', root_folder.id,
    'Demandas');
  select * into nested_folder from public.crm_move_document_folder(nested_folder.id, null);
  if nested_folder.parent_id is not null then raise exception 'Folder move to root failed'; end if;
  select * into nested_folder from public.crm_move_document_folder(nested_folder.id, root_folder.id);
  begin
    perform public.crm_move_document_folder(root_folder.id, nested_folder.id);
    raise exception 'Folder cycle was allowed';
  exception when others then
    if sqlerrm <> 'Folder cycle' then raise; end if;
  end;
  select * into first_document from public.crm_move_case_document(first_document.id, nested_folder.id);
  select * into second_document from public.crm_create_document_version(
    first_document.id, 1, 'contrato-v2.pdf', 'application/pdf', 1);
  perform public.crm_finalize_document_version(second_document.id, repeat('b', 64));
  if first_document.category <> 'General' or first_document.original_name <> 'contrato.pdf' then
    raise exception 'Document metadata contract was not preserved';
  end if;
  if second_document.version <> 2 or second_document.folder_id <> nested_folder.id
    or not public.crm_can_read_case_document(second_document.storage_path) then
    raise exception 'Document version contract failed';
  end if;
  if nested_folder.parent_id <> root_folder.id or first_document.folder_id <> nested_folder.id then
    raise exception 'Document folder contract failed';
  end if;
  select * into other_case_folder from public.crm_create_document_folder(
    '10000000-0000-4000-8000-0000000000c1', '30000000-0000-4000-8000-0000000000c2', null,
    'Otro expediente');
  begin
    perform public.crm_move_document_folder(nested_folder.id, other_case_folder.id);
    raise exception 'Cross-case folder move was allowed';
  exception when others then
    if sqlerrm <> 'Folder not found' then raise; end if;
  end;
  begin
    perform public.crm_move_case_document(second_document.id, other_case_folder.id);
    raise exception 'Cross-case document move was allowed';
  exception when others then
    if sqlerrm <> 'Folder not found' then raise; end if;
  end;
  if not exists (select 1 from public.crm_case_documents where id = second_document.id and is_current and content_status = 'validated') then
    raise exception 'Validated document version was not current';
  end if;
  begin
    perform public.crm_archive_case_document(second_document.id, 1);
    raise exception 'Stale document archive was allowed';
  exception when sqlstate '40001' then null;
  end;
  select * into archived_document from public.crm_archive_case_document(second_document.id, 2);
  if archived_document.archived_at is null or archived_document.archived_by is null
    or exists (
      select 1 from public.crm_case_documents
      where logical_document_id = second_document.logical_document_id and archived_at is null
    ) or public.crm_can_read_case_document(second_document.storage_path) then
    raise exception 'Document archive contract failed';
  end if;
  if not exists (
    select 1 from public.crm_case_document_events
    where document_id = second_document.id and event_type = 'archived'
  ) then
    raise exception 'Document archive audit event was not recorded';
  end if;
end;
$$;
rollback;
