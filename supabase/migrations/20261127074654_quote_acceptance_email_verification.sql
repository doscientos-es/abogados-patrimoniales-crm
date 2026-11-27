-- Old links are deliberately not backfilled: their recipient cannot be proven at link creation.
create table public.crm_quote_acceptance_verification (
  link_id uuid primary key references public.crm_quote_acceptance_links(id) on delete cascade,
  recipient text not null,
  code_hash text,
  code_expires_at timestamptz,
  attempts integer not null default 0,
  last_sent_at timestamptz,
  window_started_at timestamptz,
  window_sends integer not null default 0,
  verified_at timestamptz
);
alter table public.crm_quote_acceptance_verification enable row level security;
revoke all on public.crm_quote_acceptance_verification from public, anon, authenticated;

create function public.crm_capture_quote_verification_recipient()
returns trigger language plpgsql security definer set search_path = public as $$
declare recipient_email text;
begin
  select trim(public.crm_sent_quote_version(o.details) #>> '{envio,destinatario}')
    into recipient_email from public.crm_opportunities o where o.id = new.opportunity_id;
  if recipient_email is null or length(recipient_email) > 254
    or recipient_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'El envío registrado necesita un correo de destinatario válido para generar el enlace.';
  end if;
  insert into public.crm_quote_acceptance_verification(link_id, recipient)
    values (new.id, recipient_email);
  return new;
end;
$$;
revoke all on function public.crm_capture_quote_verification_recipient() from public, anon, authenticated;
create trigger crm_quote_capture_verification_recipient
after insert on public.crm_quote_acceptance_links
for each row execute function public.crm_capture_quote_verification_recipient();

-- Only the trusted mail function may obtain a code or recipient. A bearer token alone
-- never provides either through a public RPC.
create function public.crm_prepare_quote_verification(access_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  link public.crm_quote_acceptance_links;
  verification public.crm_quote_acceptance_verification;
  state text; bytes bytea; value bigint; code text; ts_now timestamptz;
begin
  if access_token is null or access_token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('status', 'invalid'); end if;
  select * into link from public.crm_quote_acceptance_links
    where token_hash = encode(extensions.digest(access_token, 'sha256'), 'hex') for update;
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  state := public.crm_public_quote_acceptance(access_token) ->> 'status';
  if state <> 'valid' then return jsonb_build_object('status', state); end if;
  select * into verification from public.crm_quote_acceptance_verification where link_id = link.id for update;
  if not found then return jsonb_build_object('status', 'email_unavailable'); end if;
  ts_now := clock_timestamp();
  if verification.last_sent_at > ts_now - interval '1 minute' then return jsonb_build_object('status', 'rate_limited'); end if;
  if verification.window_started_at > ts_now - interval '1 hour' and verification.window_sends >= 5 then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  -- Rejection sampling avoids modulo bias in a six-digit CSPRNG code.
  loop
    bytes := extensions.gen_random_bytes(4);
    value := get_byte(bytes, 0)::bigint * 16777216 + get_byte(bytes, 1)::bigint * 65536
      + get_byte(bytes, 2)::bigint * 256 + get_byte(bytes, 3)::bigint;
    exit when value < 4294000000;
  end loop;
  code := lpad((value % 1000000)::text, 6, '0');
  update public.crm_quote_acceptance_verification set
    code_hash = encode(extensions.digest(access_token || ':' || code, 'sha256'), 'hex'),
    code_expires_at = ts_now + interval '10 minutes', attempts = 0, last_sent_at = ts_now,
    window_sends = case when window_started_at > ts_now - interval '1 hour' then window_sends + 1 else 1 end,
    window_started_at = case when window_started_at > ts_now - interval '1 hour' then window_started_at else ts_now end
  where link_id = link.id;
  return jsonb_build_object('status', 'ready', 'recipient', verification.recipient, 'code', code);
end;
$$;
revoke all on function public.crm_prepare_quote_verification(text) from public, anon, authenticated;
grant execute on function public.crm_prepare_quote_verification(text) to service_role;

-- The former endpoint must not bypass verification, even when called directly via PostgREST.
revoke all on function public.crm_public_accept_quote(text, text, boolean, text) from public, anon, authenticated;
create function public.crm_public_accept_quote_verified(
  access_token text, acceptor text, confirmed boolean, user_agent text, verification_code text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  link public.crm_quote_acceptance_links; verification public.crm_quote_acceptance_verification;
  state text; result jsonb; ts_now timestamptz;
begin
  if access_token is null or access_token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('status', 'invalid'); end if;
  if confirmed is not true then return jsonb_build_object('status', 'not_confirmed'); end if;
  if nullif(trim(acceptor), '') is null or char_length(trim(acceptor)) > 160 then return jsonb_build_object('status', 'name_required'); end if;
  select * into link from public.crm_quote_acceptance_links
    where token_hash = encode(extensions.digest(access_token, 'sha256'), 'hex') for update;
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  state := public.crm_public_quote_acceptance(access_token) ->> 'status';
  if state = 'accepted' then return jsonb_build_object('status', 'accepted', 'already', true, 'acceptedAt', link.accepted_at); end if;
  if state <> 'valid' then return jsonb_build_object('status', state); end if;
  select * into verification from public.crm_quote_acceptance_verification where link_id = link.id for update;
  if not found then return jsonb_build_object('status', 'email_unavailable'); end if;
  ts_now := clock_timestamp();
  if verification.code_hash is null or verification.code_expires_at is null
    or verification.code_expires_at <= ts_now or verification.attempts >= 5 then
    return jsonb_build_object('status', 'code_expired');
  end if;
  if verification_code is null or verification_code !~ '^[0-9]{6}$'
    or verification.code_hash <> encode(extensions.digest(access_token || ':' || verification_code, 'sha256'), 'hex') then
    update public.crm_quote_acceptance_verification set attempts = attempts + 1 where link_id = link.id;
    return jsonb_build_object('status', 'code_invalid');
  end if;
  result := public.crm_public_accept_quote(access_token, acceptor, confirmed, user_agent);
  if result ->> 'status' = 'accepted' and coalesce((result ->> 'already')::boolean, false) = false then
    update public.crm_quote_acceptance_verification set code_hash = null, code_expires_at = null, verified_at = ts_now where link_id = link.id;
    insert into public.crm_opportunity_events(firm_id, opportunity_id, event_type, payload)
      values (link.firm_id, link.opportunity_id, 'acceptance_email_verified',
        jsonb_build_object('link_id', link.id, 'email', verification.recipient, 'verified_at', ts_now));
  end if;
  return result;
end;
$$;
revoke all on function public.crm_public_accept_quote_verified(text, text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.crm_public_accept_quote_verified(text, text, boolean, text, text) to anon, authenticated;
notify pgrst, 'reload schema';
