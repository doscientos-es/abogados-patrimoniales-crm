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
      or exists(select 1 from public.crm_firm_members where firm_id = '10000000-0000-4000-8000-0000000000a1') then
      raise exception 'Cross-firm read was allowed for %', test_user;
    end if;
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
