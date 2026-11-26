-- Run against an isolated test database after migrations; all data is rolled back.
begin;
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'owner@example.invalid', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated', 'admin@example.invalid', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000103', 'authenticated', 'authenticated', 'other-admin@example.invalid', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000104', 'authenticated', 'authenticated', 'other-firm@example.invalid', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000105', 'authenticated', 'authenticated', 'invited@example.invalid', now(), '{}', '{}', now(), now());
insert into public.crm_firms (id, name) values
  ('10000000-0000-4000-8000-000000000101', 'Member test A'),
  ('10000000-0000-4000-8000-000000000102', 'Member test B');
insert into public.crm_firm_members (firm_id, user_id, role, status) values
  ('10000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000101', 'owner', 'active'),
  ('10000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102', 'admin', 'active'),
  ('10000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000103', 'admin', 'active'),
  ('10000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000104', 'lawyer', 'disabled'),
  ('10000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000104', 'lawyer', 'active'),
  ('10000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000105', 'lawyer', 'invited');

do $$
declare firm uuid := '10000000-0000-4000-8000-000000000101';
  owner_id uuid := '00000000-0000-4000-8000-000000000101';
  actor uuid := '00000000-0000-4000-8000-000000000102';
  target uuid := '00000000-0000-4000-8000-000000000103';
  other uuid := '00000000-0000-4000-8000-000000000104';
begin
  if has_function_privilege('authenticated', 'public.crm_reserve_firm_member_removal(uuid,uuid,uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.crm_finish_firm_member_removal(uuid,uuid,uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.crm_delete_firm_member(uuid,uuid)', 'execute') then
    raise exception 'Removal operations must not be executable by authenticated clients';
  end if;
  if not exists (select 1 from public.crm_firm_members where user_id = '00000000-0000-4000-8000-000000000105' and status = 'active') then
    raise exception 'Already-confirmed invitation was not activated';
  end if;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform public.crm_update_firm_member(firm, target, 'admin', 'disabled');
  perform public.crm_get_firm_member_assignment_count(firm, target);
  begin
    perform public.crm_update_firm_member(firm, owner_id, 'owner', 'disabled');
    raise exception 'Owner was editable';
  exception when raise_exception then
    if sqlerrm <> 'Owner access cannot be changed here' then raise; end if;
  end;
  begin
    perform public.crm_reserve_firm_member_removal(firm, other, actor);
    raise exception 'Cross-firm account was removable';
  exception when raise_exception then
    if sqlerrm <> 'Member cannot be removed' then raise; end if;
  end;
  perform public.crm_reserve_firm_member_removal(firm, target, actor);
  begin
    update public.crm_firm_members set status = 'active' where firm_id = firm and user_id = target;
    raise exception 'Reserved member could be reactivated';
  exception when raise_exception then
    if sqlerrm <> 'Account removal is in progress or complete' then raise; end if;
  end;
  begin
    perform public.crm_finish_firm_member_removal(firm, target, actor);
    raise exception 'Account removed before Auth deletion';
  exception when raise_exception then
    if sqlerrm <> 'Account cannot be removed' then raise; end if;
  end;
  update auth.users set deleted_at = now() where id = target;
  perform public.crm_finish_firm_member_removal(firm, target, actor);
  if exists (select 1 from public.crm_firm_members where user_id = target)
    or not exists (select 1 from public.crm_profiles where id = target) then
    raise exception 'Removal must revoke membership and retain the audit profile';
  end if;
end;
$$;
rollback;