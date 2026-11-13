-- Prepared locally. Apply only after isolated authorization tests and explicit approval.
begin;

-- Database-side emergency switch applies even to direct RPC calls. Disabled by default.
create table lex_mcp.draft_settings (id boolean primary key default true check (id), enabled boolean not null default false);
insert into lex_mcp.draft_settings(id) values (true);
alter table lex_mcp.draft_settings enable row level security;
revoke all on lex_mcp.draft_settings from public, anon, authenticated;

alter table lex_mcp.credentials drop constraint credentials_scopes_check;
alter table lex_mcp.credentials add constraint credentials_scopes_check check (
  cardinality(scopes) between 1 and 5
  and scopes <@ array['leads:read','contacts:read','cases:read','documents:read','drafts:write']::text[]
  and array_position(scopes, null) is null
  and (not ('documents:read' = any(scopes)) or 'cases:read' = any(scopes))
  and (not ('drafts:write' = any(scopes)) or scopes && array['leads:read','cases:read']::text[])
);

create or replace function public.crm_mcp_create_key(
  p_firm_id uuid, p_label text, p_scopes text[], p_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_token text; v_key_id uuid;
begin
  perform 1 from public.crm_firm_members
    where firm_id = p_firm_id and user_id = auth.uid() and status = 'active' for update;
  if not found then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_label is null or char_length(trim(p_label)) not between 1 and 80
    or p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '90 days'
    or p_scopes is null or cardinality(p_scopes) not between 1 and 5
    or array_position(p_scopes, null) is not null
    or not (p_scopes <@ array['leads:read','contacts:read','cases:read','documents:read','drafts:write']::text[])
    or ('documents:read' = any(p_scopes) and not ('cases:read' = any(p_scopes)))
    or ('drafts:write' = any(p_scopes) and not (p_scopes && array['leads:read','cases:read']::text[])) then
    raise exception 'Invalid key configuration' using errcode = '22023';
  end if;
  if (select count(*) from lex_mcp.credentials where firm_id = p_firm_id and user_id = auth.uid()
    and revoked_at is null and expires_at > now()) >= 10 then
    raise exception 'Revoke an existing key first' using errcode = '22023';
  end if;
  v_token := 'lex_mcp_' || encode(extensions.gen_random_bytes(32), 'hex');
  insert into lex_mcp.credentials(firm_id, user_id, label, token_hash, scopes, expires_at)
    values(p_firm_id, auth.uid(), trim(p_label), encode(extensions.digest(v_token, 'sha256'), 'hex'), p_scopes, p_expires_at)
    returning id into v_key_id;
  insert into lex_mcp.audit(key_id, firm_id, user_id, operation, outcome)
    values(v_key_id, p_firm_id, auth.uid(), 'key_created', 'ok');
  return jsonb_build_object('id', v_key_id, 'token', v_token, 'expiresAt', p_expires_at);
end;
$$;

-- Draft text is deliberately separate from validated files and client-facing workflows.
create table public.crm_internal_document_drafts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete restrict,
  case_id uuid,
  opportunity_id uuid,
  title text not null check (char_length(trim(title)) between 1 and 180),
  content text not null check (octet_length(content) between 1 and 8000 and length(trim(content)) > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  foreign key (firm_id, case_id) references public.crm_cases(firm_id, id) on delete restrict,
  foreign key (firm_id, opportunity_id) references public.crm_opportunities(firm_id, id) on delete restrict,
  check ((case_id is null) <> (opportunity_id is null)),
  unique (firm_id, created_by, idempotency_key)
);
create index crm_internal_drafts_case_idx on public.crm_internal_document_drafts(firm_id, case_id, created_at desc) where case_id is not null;
create index crm_internal_drafts_lead_idx on public.crm_internal_document_drafts(firm_id, opportunity_id, created_at desc) where opportunity_id is not null;
alter table public.crm_internal_document_drafts enable row level security;
revoke all on public.crm_internal_document_drafts from public, anon, authenticated;
grant select on public.crm_internal_document_drafts to authenticated;
create policy crm_internal_drafts_read on public.crm_internal_document_drafts for select to authenticated
  using (public.crm_is_firm_member(firm_id) and (case_id is null or public.crm_can_access_case(case_id)));

create function public.crm_mcp_save_internal_draft(p_token text, p_args jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  k lex_mcp.credentials;
  d public.crm_internal_document_drafts;
  target_id uuid; retry_id uuid; target_type text; title text; body text; problem text;
  claims text := current_setting('request.jwt.claims', true);
  sub text := current_setting('request.jwt.claim.sub', true);
  replay boolean := false;
begin
  if p_token is null or p_token !~ '^lex_mcp_[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;
  select c.* into k from lex_mcp.credentials c
    join public.crm_firm_members m on m.firm_id = c.firm_id and m.user_id = c.user_id and m.status = 'active'
    join auth.users u on u.id = c.user_id and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
    where c.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and c.revoked_at is null and c.expires_at > now() for update of c;
  if not found then return jsonb_build_object('ok', false, 'error', 'unauthorized'); end if;
  if k.window_start <= now() - interval '1 minute' then k.window_start := now(); k.window_count := 0; end if;
  if k.window_count >= 120 then return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;
  update lex_mcp.credentials set window_start = k.window_start, window_count = k.window_count + 1, last_used_at = now() where id = k.id;
  if not ('drafts:write' = any(k.scopes)) or not exists (select 1 from lex_mcp.draft_settings where id and enabled) then problem := 'forbidden'; end if;
  if problem is null then
    begin
      if p_args is null or jsonb_typeof(p_args) <> 'object' or octet_length(p_args::text) > 16000
        or exists (select 1 from jsonb_object_keys(p_args) a(key) where a.key not in ('targetType','targetId','title','content','idempotencyKey'))
        or jsonb_typeof(p_args->'targetType') is distinct from 'string'
        or jsonb_typeof(p_args->'targetId') is distinct from 'string'
        or jsonb_typeof(p_args->'title') is distinct from 'string'
        or jsonb_typeof(p_args->'content') is distinct from 'string'
        or jsonb_typeof(p_args->'idempotencyKey') is distinct from 'string' then raise exception 'Invalid input'; end if;
      target_type := p_args->>'targetType'; target_id := (p_args->>'targetId')::uuid;
      retry_id := (p_args->>'idempotencyKey')::uuid; title := trim(p_args->>'title'); body := p_args->>'content';
      if target_type not in ('lead','case') or char_length(title) not between 1 and 180
        or octet_length(body) not between 1 and 8000 or length(trim(body)) = 0 then raise exception 'Invalid input'; end if;
    exception when others then problem := 'invalid_arguments'; end;
  end if;
  if problem is null and not ((target_type = 'lead' and 'leads:read' = any(k.scopes))
    or (target_type = 'case' and 'cases:read' = any(k.scopes))) then problem := 'forbidden'; end if;
  if problem is null then
    perform set_config('request.jwt.claims', jsonb_build_object('sub', k.user_id, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', k.user_id::text, true);
    if target_type = 'case' then
      if not exists (select 1 from public.crm_cases c where c.id = target_id and c.firm_id = k.firm_id and public.crm_can_access_case(c.id)) then problem := 'forbidden'; end if;
    elsif not exists (select 1 from public.crm_opportunities o where o.id = target_id and o.firm_id = k.firm_id and o.archived_at is null) then
      problem := 'forbidden';
    end if;
    perform set_config('request.jwt.claims', coalesce(claims, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(sub, ''), true);
  end if;
  if problem is null then
    insert into public.crm_internal_document_drafts(firm_id, case_id, opportunity_id, title, content, created_by, idempotency_key)
    values (k.firm_id, case when target_type = 'case' then target_id end,
      case when target_type = 'lead' then target_id end, title, body, k.user_id, retry_id)
    on conflict (firm_id, created_by, idempotency_key) do nothing returning * into d;
    if not found then
      select * into d from public.crm_internal_document_drafts where firm_id = k.firm_id and created_by = k.user_id and idempotency_key = retry_id;
      if d.case_id is distinct from (case when target_type = 'case' then target_id end)
        or d.opportunity_id is distinct from (case when target_type = 'lead' then target_id end)
        or d.title is distinct from title or d.content is distinct from body then problem := 'invalid_arguments';
      else replay := true; end if;
    end if;
  end if;
  insert into lex_mcp.audit(key_id, firm_id, user_id, operation, outcome)
    values(k.id, k.firm_id, k.user_id, 'lex_save_internal_draft', coalesce(problem, 'ok'));
  if problem is not null then return jsonb_build_object('ok', false, 'error', problem); end if;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'id', d.id, 'targetType', target_type, 'targetId', target_id, 'status', 'pending_review',
    'createdAt', d.created_at, 'idempotentReplay', replay));
end;
$$;
revoke all on function public.crm_mcp_save_internal_draft(text,jsonb) from public, authenticated;
grant execute on function public.crm_mcp_save_internal_draft(text,jsonb) to anon;
notify pgrst, 'reload schema';
commit;
