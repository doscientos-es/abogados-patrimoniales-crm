-- Run with a database-administrator connection. This test creates temporary
-- identities and rolls every change back, so it never persists test data.
begin;

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'rls-a@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'rls-b-owner@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', 'rls-b-admin@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-0000000000b3', 'authenticated', 'authenticated', 'rls-b-lawyer@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-0000000000b4', 'authenticated', 'authenticated', 'rls-b-paralegal@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now());
insert into public.crm_firms (id, name) values
  ('10000000-0000-4000-8000-0000000000a1', 'RLS Audit Firm A'),
  ('10000000-0000-4000-8000-0000000000b2', 'RLS Audit Firm B');
insert into public.crm_firm_members (firm_id, user_id, role, status) values
  ('10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'owner', 'active'),
  ('10000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b1', 'owner', 'active'),
  ('10000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b2', 'admin', 'active'),
  ('10000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b3', 'lawyer', 'active'),
  ('10000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b4', 'paralegal', 'active');
insert into public.crm_contacts (firm_id, nature, relationship, display_name) values
  ('10000000-0000-4000-8000-0000000000a1', 'person', 'client', 'RLS contact A'),
  ('10000000-0000-4000-8000-0000000000b2', 'person', 'client', 'RLS contact B');
insert into public.crm_cases (id, firm_id, case_number, primary_contact_id, title, nature)
select '30000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-0000000000a1', 910001, id, 'RLS case A', 'judicial'
from public.crm_contacts where firm_id = '10000000-0000-4000-8000-0000000000a1';
insert into public.crm_cases (id, firm_id, case_number, primary_contact_id, title, nature)
select '30000000-0000-4000-8000-0000000000b2', '10000000-0000-4000-8000-0000000000b2', 910002, id, 'RLS case B', 'judicial'
from public.crm_contacts where firm_id = '10000000-0000-4000-8000-0000000000b2';
insert into public.crm_case_documents (
  id, firm_id, case_id, name, document_type, logical_document_id, version, category,
  original_name, storage_path, mime_type, size_bytes, confidentiality, checksum_sha256,
  content_status, is_current
) values
  ('40000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-0000000000a1', '30000000-0000-4000-8000-0000000000a1', 'other-firm.pdf', 'General', '40000000-0000-4000-8000-0000000000a1', 1, 'General', 'other-firm.pdf', '10000000-0000-4000-8000-0000000000a1/30000000-0000-4000-8000-0000000000a1/40000000-0000-4000-8000-0000000000a1/1/40000000-0000-4000-8000-0000000000a1', 'application/pdf', 1, 'normal', repeat('a', 64), 'validated', true),
  ('40000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-0000000000b2', '30000000-0000-4000-8000-0000000000b2', 'normal.pdf', 'General', '40000000-0000-4000-8000-0000000000b1', 1, 'General', 'normal.pdf', '10000000-0000-4000-8000-0000000000b2/30000000-0000-4000-8000-0000000000b2/40000000-0000-4000-8000-0000000000b1/1/40000000-0000-4000-8000-0000000000b1', 'application/pdf', 1, 'normal', repeat('b', 64), 'validated', true),
  ('40000000-0000-4000-8000-0000000000b2', '10000000-0000-4000-8000-0000000000b2', '30000000-0000-4000-8000-0000000000b2', 'restricted.pdf', 'General', '40000000-0000-4000-8000-0000000000b2', 1, 'General', 'restricted.pdf', '10000000-0000-4000-8000-0000000000b2/30000000-0000-4000-8000-0000000000b2/40000000-0000-4000-8000-0000000000b2/1/40000000-0000-4000-8000-0000000000b2', 'application/pdf', 1, 'restricted', repeat('c', 64), 'validated', true),
  ('40000000-0000-4000-8000-0000000000b3', '10000000-0000-4000-8000-0000000000b2', '30000000-0000-4000-8000-0000000000b2', 'confidential.pdf', 'General', '40000000-0000-4000-8000-0000000000b3', 1, 'General', 'confidential.pdf', '10000000-0000-4000-8000-0000000000b2/30000000-0000-4000-8000-0000000000b2/40000000-0000-4000-8000-0000000000b3/1/40000000-0000-4000-8000-0000000000b3', 'application/pdf', 1, 'confidential', repeat('d', 64), 'validated', true);
insert into storage.objects (bucket_id, name, owner, metadata)
select 'case-documents', storage_path, '00000000-0000-4000-8000-0000000000b1', '{}'::jsonb
from public.crm_case_documents where firm_id = '10000000-0000-4000-8000-0000000000b2';

set local role authenticated;
do $$
declare affected_rows integer; test_user uuid;
begin
  foreach test_user in array array[
    '00000000-0000-4000-8000-0000000000b1'::uuid,
    '00000000-0000-4000-8000-0000000000b2'::uuid,
    '00000000-0000-4000-8000-0000000000b3'::uuid,
    '00000000-0000-4000-8000-0000000000b4'::uuid
  ] loop
    perform set_config('request.jwt.claim.sub', test_user::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    if exists(select 1 from public.crm_firms where id = '10000000-0000-4000-8000-0000000000a1')
      or exists(select 1 from public.crm_contacts where firm_id = '10000000-0000-4000-8000-0000000000a1')
      or exists(select 1 from public.crm_firm_members where firm_id = '10000000-0000-4000-8000-0000000000a1')
      or exists(select 1 from public.crm_case_documents where firm_id = '10000000-0000-4000-8000-0000000000a1') then
      raise exception 'Cross-firm read was allowed for %', test_user;
    end if;
    begin
      perform public.crm_create_document_version(
        '40000000-0000-4000-8000-0000000000a1', 1, 'forbidden.pdf', 'application/pdf', 1
      );
      raise exception 'Cross-firm document version was allowed for %', test_user;
    exception when others then
      if sqlerrm <> 'Document not found' then raise; end if;
    end;
    begin
      insert into public.crm_contacts (firm_id, nature, relationship, display_name)
      values ('10000000-0000-4000-8000-0000000000a1', 'person', 'client', 'cross-firm write');
      raise exception 'Cross-firm contact insertion was allowed for %', test_user;
    exception when insufficient_privilege then null;
    end;
    update public.crm_firm_members set role = 'owner'
    where firm_id = '10000000-0000-4000-8000-0000000000b2' and user_id = test_user;
    get diagnostics affected_rows = row_count;
    if affected_rows <> 0 then raise exception 'Self role escalation was allowed for %', test_user; end if;
    if not exists(select 1 from public.crm_case_documents where id = '40000000-0000-4000-8000-0000000000b1')
      or not exists(select 1 from storage.objects where bucket_id = 'case-documents' and name like '%40000000-0000-4000-8000-0000000000b1') then
      raise exception 'Normal document was hidden for %', test_user;
    end if;
    if test_user = '00000000-0000-4000-8000-0000000000b4'::uuid then
      if exists(select 1 from public.crm_case_documents where id in ('40000000-0000-4000-8000-0000000000b2', '40000000-0000-4000-8000-0000000000b3'))
        or exists(select 1 from storage.objects where bucket_id = 'case-documents' and name like '%40000000-0000-4000-8000-0000000000b2')
        or exists(select 1 from storage.objects where bucket_id = 'case-documents' and name like '%40000000-0000-4000-8000-0000000000b3') then
        raise exception 'Paralegal received restricted document access';
      end if;
    elsif test_user = '00000000-0000-4000-8000-0000000000b3'::uuid then
      if not exists(select 1 from public.crm_case_documents where id = '40000000-0000-4000-8000-0000000000b2')
        or exists(select 1 from public.crm_case_documents where id = '40000000-0000-4000-8000-0000000000b3') then
        raise exception 'Lawyer confidentiality access is incorrect';
      end if;
    elsif not exists(select 1 from public.crm_case_documents where id in ('40000000-0000-4000-8000-0000000000b2', '40000000-0000-4000-8000-0000000000b3')) then
      raise exception 'Owner or admin did not receive confidential document access';
    end if;
  end loop;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b4', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select jsonb_build_object(
  'own_firm_visible', exists(select 1 from public.crm_firms where id = '10000000-0000-4000-8000-0000000000b2'),
  'other_firm_hidden', not exists(select 1 from public.crm_firms where id = '10000000-0000-4000-8000-0000000000a1'),
  'own_contact_visible', exists(select 1 from public.crm_contacts where firm_id = '10000000-0000-4000-8000-0000000000b2'),
  'other_contact_hidden', not exists(select 1 from public.crm_contacts where firm_id = '10000000-0000-4000-8000-0000000000a1'),
  'other_membership_hidden', not exists(select 1 from public.crm_firm_members where firm_id = '10000000-0000-4000-8000-0000000000a1')
) as rls_matrix;

rollback;
