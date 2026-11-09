-- Run after the migration with an administrator connection; fixtures are rolled back.
begin;

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  ('99100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'chat-owner@example.invalid', '{}', '{}'),
  ('99100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'chat-lawyer@example.invalid', '{}', '{}'),
  ('99100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'chat-outsider@example.invalid', '{}', '{}');
insert into public.crm_firms (id, name) values
  ('99200000-0000-4000-8000-000000000001', 'Chat test A'),
  ('99200000-0000-4000-8000-000000000002', 'Chat test B');
insert into public.crm_firm_members (firm_id, user_id, role, status) values
  ('99200000-0000-4000-8000-000000000001', '99100000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('99200000-0000-4000-8000-000000000001', '99100000-0000-4000-8000-000000000002', 'lawyer', 'active'),
  ('99200000-0000-4000-8000-000000000002', '99100000-0000-4000-8000-000000000003', 'owner', 'active');
insert into public.crm_contacts (id, firm_id, reference, nature, relationship, display_name) values
  ('99300000-0000-4000-8000-000000000001', '99200000-0000-4000-8000-000000000001', 'CHAT-TEST-A', 'person', 'client', 'Chat contact A'),
  ('99300000-0000-4000-8000-000000000002', '99200000-0000-4000-8000-000000000002', 'CHAT-TEST-B', 'person', 'client', 'Chat contact B');
insert into public.crm_opportunities (id, firm_id, contact_id, reference, title) values
  ('99400000-0000-4000-8000-000000000001', '99200000-0000-4000-8000-000000000001', '99300000-0000-4000-8000-000000000001', 'CHAT-LEAD-A', 'Chat lead A'),
  ('99400000-0000-4000-8000-000000000002', '99200000-0000-4000-8000-000000000001', '99300000-0000-4000-8000-000000000001', 'CHAT-LEAD-A2', 'Chat lead A2'),
  ('99400000-0000-4000-8000-000000000003', '99200000-0000-4000-8000-000000000002', '99300000-0000-4000-8000-000000000002', 'CHAT-LEAD-B', 'Chat lead B');

set local role authenticated;
do $$
declare
  lead_a uuid := '99400000-0000-4000-8000-000000000001';
  lead_a2 uuid := '99400000-0000-4000-8000-000000000002';
  lead_b uuid := '99400000-0000-4000-8000-000000000003';
  owner_id uuid := '99100000-0000-4000-8000-000000000001';
  lawyer_id uuid := '99100000-0000-4000-8000-000000000002';
  private_url text := 'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc';
  app_url text := 'chatgpt://conversation/87654321-1234-1234-1234-123456789abc';
  affected integer;
begin
  perform set_config('request.jwt.claim.sub', lawyer_id::text, true);
  insert into public.crm_lead_chatgpt_links (opportunity_id, user_id, conversation_url)
  values (lead_a, lawyer_id, private_url), (lead_a2, lawyer_id, app_url);
  -- Exercise the same upsert as the client, including update column privileges.
  insert into public.crm_lead_chatgpt_links (opportunity_id, user_id, conversation_url)
  values (lead_a, lawyer_id, app_url)
  on conflict (opportunity_id, user_id) do update
  set opportunity_id = excluded.opportunity_id, user_id = excluded.user_id,
      conversation_url = excluded.conversation_url;
  if (select count(*) from public.crm_lead_chatgpt_links) <> 2 then
    raise exception 'Own bookmarks must persist independently for each lead';
  end if;
  if (select conversation_url from public.crm_lead_chatgpt_links where opportunity_id = lead_a) <> app_url then
    raise exception 'Updating an existing bookmark failed';
  end if;
  begin
    insert into public.crm_lead_chatgpt_links (opportunity_id, user_id, conversation_url)
    values (lead_b, lawyer_id, private_url);
    raise exception 'Cross-firm bookmark insert was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.crm_lead_chatgpt_links set conversation_url = 'javascript:alert(1)' where opportunity_id = lead_a;
    raise exception 'Unsafe URL was allowed';
  exception when check_violation then null;
  end;
  begin
    update public.crm_lead_chatgpt_links set conversation_url = replace(private_url, '/c/', '/share/') where opportunity_id = lead_a;
    raise exception 'Public shared conversation was allowed';
  exception when check_violation then null;
  end;
  begin
    update public.crm_lead_chatgpt_links set user_id = owner_id where opportunity_id = lead_a;
    raise exception 'Bookmark ownership transfer was allowed';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  if exists (select 1 from public.crm_lead_chatgpt_links) then
    raise exception 'Even a firm owner must not read another user bookmark';
  end if;
  update public.crm_lead_chatgpt_links set conversation_url = private_url where user_id = lawyer_id;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another user bookmark could be changed'; end if;
  delete from public.crm_lead_chatgpt_links where user_id = lawyer_id;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another user bookmark could be deleted'; end if;
  begin
    insert into public.crm_lead_chatgpt_links (opportunity_id, user_id, conversation_url)
    values (lead_a, lawyer_id, private_url);
    raise exception 'Another user bookmark could be created';
  exception when insufficient_privilege then null;
  end;
  insert into public.crm_lead_chatgpt_links (opportunity_id, user_id, conversation_url)
  values (lead_a, owner_id, private_url);
  if (select count(*) from public.crm_lead_chatgpt_links) <> 1 then
    raise exception 'Each user must have their own bookmark for the same lead';
  end if;
  delete from public.crm_lead_chatgpt_links where opportunity_id = lead_a;
  if exists (select 1 from public.crm_lead_chatgpt_links) then
    raise exception 'Unlinking own bookmark failed';
  end if;

  perform set_config('request.jwt.claim.sub', '99100000-0000-4000-8000-000000000003', true);
  if exists (select 1 from public.crm_lead_chatgpt_links) then
    raise exception 'Cross-firm read was allowed';
  end if;
end;
$$;

reset role;
update public.crm_firm_members set status = 'disabled'
where user_id = '99100000-0000-4000-8000-000000000002';
set local role authenticated;
do $$
begin
  perform set_config('request.jwt.claim.sub', '99100000-0000-4000-8000-000000000002', true);
  if exists (select 1 from public.crm_lead_chatgpt_links) then
    raise exception 'Disabled members must lose access to their bookmarks';
  end if;
end;
$$;

set local role anon;
do $$
begin
  begin
    perform 1 from public.crm_lead_chatgpt_links;
    raise exception 'Anonymous access was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;