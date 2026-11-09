-- Prepared locally; do not apply to production without explicit approval.
-- Schema/helpers checked read-only against abogados-patrimoniales-crm on 2026-11-09.
-- Dedicated opaque MCP credentials, never Supabase sessions or service-role credentials.
begin;

create schema lex_mcp;
revoke all on schema lex_mcp from public, anon, authenticated;

create table lex_mcp.credentials (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  user_id uuid not null,
  label text not null check (char_length(trim(label)) between 1 and 80),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null check (
    cardinality(scopes) between 1 and 4
    and scopes <@ array['leads:read','contacts:read','cases:read','documents:read']::text[]
    and array_position(scopes, null) is null
    and (not ('documents:read' = any(scopes)) or 'cases:read' = any(scopes))
  ),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at > created_at and expires_at <= created_at + interval '90 days'),
  revoked_at timestamptz,
  last_used_at timestamptz,
  window_start timestamptz not null default now(),
  window_count integer not null default 0,
  foreign key (firm_id, user_id) references public.crm_firm_members(firm_id, user_id) on delete cascade
);
create index credentials_owner_idx on lex_mcp.credentials(firm_id, user_id);

-- Deliberately no payload, prompt, search text, record content, token or hash in the audit.
-- UUID snapshots survive account/key removal; retention is an operator policy.
create table lex_mcp.audit (
  id bigint generated always as identity primary key,
  key_id uuid not null,
  firm_id uuid not null,
  user_id uuid not null,
  operation text not null,
  outcome text not null,
  created_at timestamptz not null default now()
);
create index audit_firm_created_idx on lex_mcp.audit(firm_id, created_at desc);
alter table lex_mcp.credentials enable row level security;
alter table lex_mcp.audit enable row level security;
revoke all on all tables in schema lex_mcp from public, anon, authenticated;
revoke all on all sequences in schema lex_mcp from public, anon, authenticated;

-- Account management is exclusively available through an authenticated LEX session.
-- Each person issues their own key; no impersonation/user_id parameter exists.
create function public.crm_mcp_create_key(
  p_firm_id uuid, p_label text, p_scopes text[], p_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_token text;
  v_key_id uuid;
begin
  perform 1 from public.crm_firm_members
    where firm_id = p_firm_id and user_id = auth.uid() and status = 'active' for update;
  if not found then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_label is null or char_length(trim(p_label)) not between 1 and 80
    or p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '90 days'
    or p_scopes is null or cardinality(p_scopes) not between 1 and 4
    or array_position(p_scopes, null) is not null
    or not (p_scopes <@ array['leads:read','contacts:read','cases:read','documents:read']::text[])
    or ('documents:read' = any(p_scopes) and not ('cases:read' = any(p_scopes))) then
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

create function public.crm_mcp_list_keys(p_firm_id uuid)
returns jsonb language sql security definer set search_path = '' stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', k.id, 'userId', k.user_id, 'label', k.label, 'scopes', k.scopes,
    'createdAt', k.created_at, 'expiresAt', k.expires_at, 'revokedAt', k.revoked_at, 'lastUsedAt', k.last_used_at
  ) order by k.created_at desc), '[]'::jsonb)
  from lex_mcp.credentials k
  join public.crm_firm_members m on m.firm_id = k.firm_id and m.user_id = auth.uid() and m.status = 'active'
  where k.firm_id = p_firm_id and (k.user_id = auth.uid() or m.role in ('owner','admin'));
$$;

create function public.crm_mcp_revoke_key(p_key_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_key lex_mcp.credentials;
begin
  update lex_mcp.credentials k set revoked_at = coalesce(k.revoked_at, now())
  from public.crm_firm_members m
  where k.id = p_key_id and m.firm_id = k.firm_id and m.user_id = auth.uid() and m.status = 'active'
    and (k.user_id = auth.uid() or m.role in ('owner','admin')) returning k.* into v_key;
  if not found then raise exception 'Key not found' using errcode = '42501'; end if;
  insert into lex_mcp.audit(key_id, firm_id, user_id, operation, outcome)
    values(v_key.id, v_key.firm_id, auth.uid(), 'key_revoked', 'ok');
end;
$$;

-- Fixed SQL projections only. SECURITY DEFINER does NOT imply RLS here: tenant filters,
-- live membership and existing record-level helpers are explicitly applied in every branch.
-- No API exposes an arbitrary table, projection, order, SQL expression, URL or identity.
create function public.crm_mcp_read(p_token text, p_operation text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_key lex_mcp.credentials;
  v_role public.crm_member_role;
  v_scope text;
  v_result jsonb;
  v_error text;
  v_id uuid;
  v_case_id uuid;
  v_query text;
  v_limit integer;
  v_offset integer;
  v_claims text := current_setting('request.jwt.claims', true);
  v_sub text := current_setting('request.jwt.claim.sub', true);
begin
  if p_token is null or p_token !~ '^lex_mcp_[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;
  select k.* into v_key from lex_mcp.credentials k
    join public.crm_firm_members m on m.firm_id = k.firm_id and m.user_id = k.user_id and m.status = 'active'
    join auth.users u on u.id = k.user_id and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
    where k.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and k.revoked_at is null and k.expires_at > now() for update of k;
  if not found then return jsonb_build_object('ok', false, 'error', 'unauthorized'); end if;
  select role into v_role from public.crm_firm_members
    where firm_id = v_key.firm_id and user_id = v_key.user_id and status = 'active';

  -- Atomic across all HTTP instances and direct RPC callers; unknown keys are limited at the edge.
  if v_key.window_start <= now() - interval '1 minute' then
    v_key.window_start := now(); v_key.window_count := 0;
  end if;
  if v_key.window_count >= 120 then
    -- Do not insert unbounded rate-limit audit rows.
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  update lex_mcp.credentials set window_start = v_key.window_start,
    window_count = v_key.window_count + 1, last_used_at = now() where id = v_key.id;

  v_scope := case p_operation
    when 'lex_whoami' then null
    when 'lex_search_leads' then 'leads:read' when 'lex_get_lead' then 'leads:read'
    when 'lex_search_contacts' then 'contacts:read' when 'lex_get_contact' then 'contacts:read'
    when 'lex_search_cases' then 'cases:read' when 'lex_get_case' then 'cases:read'
    when 'lex_list_case_documents' then 'documents:read' else 'unknown' end;
  if v_scope is not null and not (v_scope = any(v_key.scopes)) then v_error := 'forbidden'; end if;
  if p_operation = 'lex_list_case_documents' and not ('cases:read' = any(v_key.scopes)) then v_error := 'forbidden'; end if;
  if p_operation is null then v_error := 'invalid_arguments'; end if;

  -- Validate again in the database: calling the RPC directly must never bypass HTTP validation.
  if v_error is null then
    begin
      if p_args is null or jsonb_typeof(p_args) <> 'object' or octet_length(p_args::text) > 4096
        or exists (select 1 from jsonb_object_keys(p_args) a(key) where not (
          (p_operation like 'lex_search_%' and a.key in ('query','limit','offset'))
          or (p_operation in ('lex_get_lead','lex_get_contact','lex_get_case') and a.key = 'id')
          or (p_operation = 'lex_list_case_documents' and a.key in ('caseId','query','limit','offset'))
        )) then raise exception 'Invalid arguments'; end if;
      if p_args ? 'query' and jsonb_typeof(p_args->'query') <> 'string' then raise exception 'Invalid query'; end if;
      v_query := trim(coalesce(p_args->>'query', ''));
      if char_length(v_query) > 120 then raise exception 'Invalid query'; end if;
      if (p_args ? 'limit' and (p_args->>'limit' !~ '^[0-9]+$' or jsonb_typeof(p_args->'limit') <> 'number'))
        or (p_args ? 'offset' and (p_args->>'offset' !~ '^[0-9]+$' or jsonb_typeof(p_args->'offset') <> 'number')) then
        raise exception 'Invalid pagination';
      end if;
      v_limit := coalesce((p_args->>'limit')::integer, 20);
      v_offset := coalesce((p_args->>'offset')::integer, 0);
      if v_limit not between 1 and 50 or v_offset not between 0 and 10000 then raise exception 'Invalid pagination'; end if;
      if p_operation in ('lex_get_lead','lex_get_contact','lex_get_case') then
        if jsonb_typeof(p_args->'id') is distinct from 'string' then raise exception 'Missing id'; end if;
        v_id := (p_args->>'id')::uuid;
      end if;
      if p_operation = 'lex_list_case_documents' then
        if jsonb_typeof(p_args->'caseId') is distinct from 'string' then raise exception 'Missing caseId'; end if;
        v_case_id := (p_args->>'caseId')::uuid;
      end if;
    exception when others then v_error := 'invalid_arguments';
    end;
  end if;

  if v_error is null then
    -- Transaction-local identity for existing permission helpers. Never supplied by the caller;
    -- reset before returning. No JWT is minted or returned, and the SQL role is not changed.
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_key.user_id, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_key.user_id::text, true);
    case
    when p_operation = 'lex_whoami' then
      v_result := jsonb_build_object('userId', v_key.user_id, 'firmId', v_key.firm_id,
        'keyId', v_key.id, 'role', v_role, 'scopes', v_key.scopes);
    when p_operation in ('lex_search_leads','lex_get_lead') then
      select coalesce(jsonb_agg(to_jsonb(r) order by r.updated_at desc, r.id), '[]'::jsonb) into v_result from (
        select o.id, o.reference, o.contact_id, o.title, o.area, o.stage, o.substage,
          o.priority, o.operational_status, o.assigned_to, o.updated_at,
          case when p_operation = 'lex_get_lead' then left(o.description, 12000) end as description
        from public.crm_opportunities o where o.firm_id = v_key.firm_id and o.archived_at is null
          -- Leads and contacts follow the application's firm-wide SELECT policies.
          and (v_id is null or o.id = v_id)
          and (v_query = '' or strpos(lower(o.title || ' ' || o.reference), lower(v_query)) > 0)
        order by o.updated_at desc, o.id limit v_limit + 1 offset v_offset
      ) r;
    when p_operation in ('lex_search_contacts','lex_get_contact') then
      select coalesce(jsonb_agg(to_jsonb(r) order by r.updated_at desc, r.id), '[]'::jsonb) into v_result from (
        select c.id, c.reference, c.display_name, c.nature, c.relationship, c.status, c.updated_at,
          case when p_operation = 'lex_get_contact' then c.email end as email,
          case when p_operation = 'lex_get_contact' then c.phone end as phone
        from public.crm_contacts c where c.firm_id = v_key.firm_id and c.status <> 'archived'
          and (v_id is null or c.id = v_id)
          and (v_query = '' or strpos(lower(c.display_name || ' ' || c.reference), lower(v_query)) > 0)
        order by c.updated_at desc, c.id limit v_limit + 1 offset v_offset
      ) r;
    when p_operation in ('lex_search_cases','lex_get_case') then
      select coalesce(jsonb_agg(to_jsonb(r) order by r.updated_at desc, r.id), '[]'::jsonb) into v_result from (
        select c.id, c.reference, c.title, c.area, c.phase, c.general_status, c.operational_status,
          c.priority, c.assigned_to, left(c.next_action, 4000) as next_action, c.updated_at,
          case when p_operation = 'lex_get_case' then left(c.current_position, 12000) end as current_position
        from public.crm_cases c where c.firm_id = v_key.firm_id and public.crm_can_access_case(c.id)
          and (v_id is null or c.id = v_id)
          and (v_query = '' or strpos(lower(c.title || ' ' || c.reference), lower(v_query)) > 0)
        order by c.updated_at desc, c.id limit v_limit + 1 offset v_offset
      ) r;
    when p_operation = 'lex_list_case_documents' then
      select coalesce(jsonb_agg(to_jsonb(r) order by r.updated_at desc, r.id), '[]'::jsonb) into v_result from (
        select d.id, d.case_id, d.original_name, d.category, d.mime_type, d.version, d.updated_at
        from public.crm_case_documents d where d.firm_id = v_key.firm_id and d.case_id = v_case_id
          and public.crm_can_access_case(d.case_id) and public.crm_can_read_case_document(d.storage_path)
          and d.is_current and d.archived_at is null and d.content_status = 'validated'
          and (v_query = '' or strpos(lower(d.original_name), lower(v_query)) > 0)
        order by d.updated_at desc, d.id limit v_limit + 1 offset v_offset
      ) r;
    else v_error := 'invalid_arguments';
    end case;
    perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);

    if p_operation in ('lex_get_lead','lex_get_contact','lex_get_case') then
      v_result := jsonb_build_object('record', v_result->0);
    elsif p_operation <> 'lex_whoami' then
      v_result := jsonb_build_object('items', (select coalesce(jsonb_agg(e.value order by e.ordinality), '[]'::jsonb)
          from jsonb_array_elements(v_result) with ordinality e(value, ordinality) where e.ordinality <= v_limit),
        'nextOffset', case when jsonb_array_length(v_result) > v_limit then v_offset + v_limit end,
        'pagination', 'offset; mutable data may move between pages');
    end if;
  end if;
  insert into lex_mcp.audit(key_id, firm_id, user_id, operation, outcome)
    values(v_key.id, v_key.firm_id, v_key.user_id,
      case when v_scope is distinct from 'unknown' and p_operation is not null then p_operation else 'unknown' end,
      coalesce(v_error, 'ok'));
  if v_error is not null then return jsonb_build_object('ok', false, 'error', v_error); end if;
  return jsonb_build_object('ok', true, 'data', v_result);
end;
$$;

revoke all on function public.crm_mcp_create_key(uuid,text,text[],timestamptz) from public, anon;
revoke all on function public.crm_mcp_list_keys(uuid) from public, anon;
revoke all on function public.crm_mcp_revoke_key(uuid) from public, anon;
grant execute on function public.crm_mcp_create_key(uuid,text,text[],timestamptz) to authenticated;
grant execute on function public.crm_mcp_list_keys(uuid) to authenticated;
grant execute on function public.crm_mcp_revoke_key(uuid) to authenticated;
revoke all on function public.crm_mcp_read(text,text,jsonb) from public, authenticated;
grant execute on function public.crm_mcp_read(text,text,jsonb) to anon;
commit;