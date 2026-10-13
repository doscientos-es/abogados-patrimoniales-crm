-- Public quote acceptance is scoped to a random token whose SHA-256 hash is stored here.
-- Public callers can only inspect/accept that quote through the two narrow RPCs below.
create extension if not exists pgcrypto with schema extensions;

alter table public.crm_onboardings alter column proforma_sent_on drop not null;

create or replace function public.crm_create_onboarding(
  target_firm_id uuid, target_contact_id uuid, target_opportunity_id uuid,
  new_matter_title text, new_quote_reference text, new_quote_amount numeric,
  new_assigned_to uuid, new_proforma_sent_on date, new_next_action text default ''
)
returns public.crm_onboardings language plpgsql security definer set search_path = public as $$
declare saved public.crm_onboardings; next_number integer; lead public.crm_opportunities;
begin
  if auth.uid() is null or not public.crm_is_firm_member(target_firm_id) then raise exception 'Forbidden'; end if;
  if nullif(trim(new_matter_title), '') is null or char_length(trim(new_matter_title)) > 300 then raise exception 'Matter title is required'; end if;
  if nullif(trim(new_quote_reference), '') is null or char_length(trim(new_quote_reference)) > 120 then raise exception 'Quote reference is required'; end if;
  if new_quote_amount is not null and new_quote_amount < 0 then raise exception 'Quote amount cannot be negative'; end if;
  select * into lead from public.crm_opportunities where id = target_opportunity_id for update;
  if not found or lead.firm_id <> target_firm_id or lead.contact_id <> target_contact_id then raise exception 'Lead not found'; end if;
  if lead.stage <> 'won' then raise exception 'Only accepted leads can start onboarding'; end if;
  if exists (select 1 from public.crm_onboardings where opportunity_id = lead.id) then raise exception 'This lead already has onboarding'; end if;
  update public.crm_firms set onboarding_sequence = onboarding_sequence + 1 where id = target_firm_id
  returning onboarding_sequence into next_number;
  insert into public.crm_onboardings (
    firm_id, contact_id, opportunity_id, reference, matter_title, phase, phase_changed_on,
    quote_reference, quote_amount, proforma_sent_on, assigned_to, next_action
  ) values (
    target_firm_id, target_contact_id, target_opportunity_id,
    'ONB-' || extract(year from current_date)::text || '-' || lpad(next_number::text, 5, '0'),
    trim(new_matter_title), 'proforma', current_date, trim(new_quote_reference),
    new_quote_amount, new_proforma_sent_on, new_assigned_to, trim(coalesce(new_next_action, ''))
  ) returning * into saved;
  return saved;
end;
$$;

create table if not exists public.crm_quote_acceptance_links (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  quote_version integer not null check (quote_version > 0),
  quote_reference text not null default '',
  token_hash text not null unique,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  client_name text not null default '',
  firm_name text not null default '',
  total_cents bigint,
  created_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references public.crm_profiles(id) on delete set null,
  accepted_at timestamptz,
  acceptor_name text,
  acceptor_user_agent text
);
create index if not exists crm_quote_acceptance_links_opp_idx
  on public.crm_quote_acceptance_links (opportunity_id, created_at desc);

revoke all on public.crm_quote_acceptance_links from public, anon, authenticated;
grant select on public.crm_quote_acceptance_links to authenticated;
grant all on public.crm_quote_acceptance_links to service_role;
alter table public.crm_quote_acceptance_links enable row level security;
drop policy if exists crm_quote_acceptance_links_member_read on public.crm_quote_acceptance_links;
create policy crm_quote_acceptance_links_member_read on public.crm_quote_acceptance_links
  for select to authenticated using (public.crm_is_firm_member(firm_id));

create or replace function public.crm_sent_quote_version(details jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select v
  from jsonb_array_elements(
    jsonb_build_array(details #> '{presupuesto,editor,actual}')
    || coalesce(details #> '{presupuesto,editor,anteriores}', '[]'::jsonb)
  ) v
  where (v ->> 'version')::integer = (details #>> '{presupuesto,versionEnviada}')::integer
    and v ? 'envio'
  limit 1
$$;

create or replace function public.crm_create_quote_acceptance_link(
  target_opportunity_id uuid, valid_days integer default 30
)
returns table (link_id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  lead public.crm_opportunities; version_record jsonb; frozen_copy jsonb;
  plain_token text; saved public.crm_quote_acceptance_links;
  contact_label text; firm_label text; amount_cents bigint;
begin
  select * into lead from public.crm_opportunities where id = target_opportunity_id for update;
  if not found or auth.uid() is null or not public.crm_is_firm_member(lead.firm_id) then raise exception 'Forbidden'; end if;
  if lead.stage <> 'engagement' then raise exception 'El Lead debe estar enviado al cliente y pendiente de aceptación'; end if;
  if lead.details -> 'aceptacion' ->> 'fecha' is not null then raise exception 'El presupuesto ya está aceptado'; end if;
  version_record := public.crm_sent_quote_version(lead.details);
  if version_record is null then raise exception 'No hay una versión enviada con documento congelado'; end if;
  frozen_copy := coalesce(version_record #> '{envio,copia}', version_record - 'envio' - 'revision' - 'revisiones' - 'borradorEnvio' - 'envioTarea');
  if frozen_copy -> 'lineas' is null then raise exception 'La versión enviada no tiene documento congelado'; end if;
  amount_cents := nullif(frozen_copy #>> '{instantanea,totales,total}', '')::bigint;

  select nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '')
    into contact_label from public.crm_contacts c where c.id = lead.contact_id;
  select f.name into firm_label from public.crm_firms f where f.id = lead.firm_id;

  update public.crm_quote_acceptance_links l
    set revoked_at = now(), revoked_by = auth.uid()
    where l.opportunity_id = lead.id and l.revoked_at is null and l.accepted_at is null;
  plain_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.crm_quote_acceptance_links (
    firm_id, opportunity_id, quote_version, quote_reference, token_hash, snapshot,
    client_name, firm_name, total_cents, created_by, expires_at
  ) values (
    lead.firm_id, lead.id, (version_record ->> 'version')::integer,
    coalesce(version_record ->> 'referencia', ''),
    encode(extensions.digest(plain_token, 'sha256'), 'hex'), frozen_copy,
    coalesce(nullif(trim(frozen_copy #>> '{instantanea,cliente,nombre}'), ''), contact_label, ''),
    coalesce(nullif(trim(frozen_copy #>> '{instantanea,despacho}'), ''), firm_label, ''),
    amount_cents, auth.uid(), now() + make_interval(days => greatest(1, least(coalesce(valid_days, 30), 90)))
  ) returning * into saved;

  insert into public.crm_opportunity_events (firm_id, opportunity_id, event_type, payload)
  values (lead.firm_id, lead.id, 'acceptance_link_created',
    jsonb_build_object('link_id', saved.id, 'version', saved.quote_version, 'expires_at', saved.expires_at, 'by', auth.uid()));
  return query select saved.id, plain_token, saved.expires_at;
end;
$$;

create or replace function public.crm_revoke_quote_acceptance_link(target_link_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare acceptance_link public.crm_quote_acceptance_links;
begin
  select * into acceptance_link from public.crm_quote_acceptance_links where id = target_link_id for update;
  if not found or auth.uid() is null or not public.crm_is_firm_member(acceptance_link.firm_id) then raise exception 'Forbidden'; end if;
  if acceptance_link.accepted_at is not null then raise exception 'El enlace ya se usó para aceptar'; end if;
  update public.crm_quote_acceptance_links
    set revoked_at = coalesce(revoked_at, now()), revoked_by = auth.uid() where id = acceptance_link.id;
  insert into public.crm_opportunity_events (firm_id, opportunity_id, event_type, payload)
  values (acceptance_link.firm_id, acceptance_link.opportunity_id, 'acceptance_link_revoked',
    jsonb_build_object('link_id', acceptance_link.id, 'by', auth.uid()));
end;
$$;

create or replace function public.crm_public_quote_acceptance(access_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare acceptance_link public.crm_quote_acceptance_links; lead public.crm_opportunities; state text;
begin
  if access_token is null or access_token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('status', 'invalid'); end if;
  select * into acceptance_link from public.crm_quote_acceptance_links
    where token_hash = encode(extensions.digest(access_token, 'sha256'), 'hex');
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  select * into lead from public.crm_opportunities where id = acceptance_link.opportunity_id;
  state := case
    when acceptance_link.accepted_at is not null then 'accepted'
    when acceptance_link.revoked_at is not null then 'revoked'
    when acceptance_link.expires_at < now() then 'expired'
    when lead.id is null or lead.stage <> 'engagement'
      or (lead.details #>> '{presupuesto,versionEnviada}')::integer is distinct from acceptance_link.quote_version then 'superseded'
    else 'valid' end;
  if state not in ('valid', 'accepted') then return jsonb_build_object('status', state); end if;
  return jsonb_build_object(
    'status', state, 'version', acceptance_link.quote_version, 'reference', acceptance_link.quote_reference,
    'snapshot', acceptance_link.snapshot - 'instantanea',
    'clientName', acceptance_link.client_name, 'firmName', acceptance_link.firm_name,
    'totalCents', acceptance_link.total_cents, 'expiresAt', acceptance_link.expires_at,
    'acceptedAt', acceptance_link.accepted_at, 'acceptorName', acceptance_link.acceptor_name
  );
end;
$$;

create or replace function public.crm_public_accept_quote(
  access_token text, acceptor text, confirmed boolean, user_agent text default ''
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  acceptance_link public.crm_quote_acceptance_links; lead public.crm_opportunities;
  saved_lead public.crm_opportunities; followup public.crm_tasks; proforma_task public.crm_tasks;
  onboarding_number integer; existing_onboarding uuid; acceptance jsonb;
  notify_to uuid; followup_id uuid; now_ts timestamptz := now();
begin
  if access_token is null or access_token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('status', 'invalid'); end if;
  if confirmed is not true then return jsonb_build_object('status', 'not_confirmed'); end if;
  if nullif(trim(acceptor), '') is null or char_length(trim(acceptor)) > 160 then return jsonb_build_object('status', 'name_required'); end if;

  select * into acceptance_link from public.crm_quote_acceptance_links
    where token_hash = encode(extensions.digest(access_token, 'sha256'), 'hex') for update;
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  if acceptance_link.accepted_at is not null then
    return jsonb_build_object('status', 'accepted', 'already', true, 'acceptedAt', acceptance_link.accepted_at);
  end if;
  if acceptance_link.revoked_at is not null then return jsonb_build_object('status', 'revoked'); end if;
  if acceptance_link.expires_at < now_ts then return jsonb_build_object('status', 'expired'); end if;

  select * into lead from public.crm_opportunities where id = acceptance_link.opportunity_id for update;
  if not found or lead.stage <> 'engagement'
    or (lead.details #>> '{presupuesto,versionEnviada}')::integer is distinct from acceptance_link.quote_version
    or lead.details -> 'aceptacion' ->> 'fecha' is not null then
    return jsonb_build_object('status', 'superseded');
  end if;

  acceptance := jsonb_build_object(
    'fecha', to_char(now_ts at time zone 'Europe/Madrid', 'YYYY-MM-DD'),
    'fechaHora', now_ts, 'version', acceptance_link.quote_version,
    'importe', case when acceptance_link.total_cents is null then '' else to_char(acceptance_link.total_cents / 100.0, 'FM999999990.00') end,
    'importeCents', acceptance_link.total_cents, 'estado', 'Aceptado', 'forma', 'Aceptado', 'medio', 'Online',
    'canal', 'online', 'aceptante', trim(acceptor),
    'evidencia', jsonb_build_object('tipo', 'enlace', 'enlaceId', acceptance_link.id,
      'texto', 'He leído y acepto el presupuesto y las condiciones del encargo',
      'userAgent', left(coalesce(user_agent, ''), 400)),
    'soporte', 'Aceptación online por enlace (ref. ' || acceptance_link.id || ')', 'registradaPor', null
  );
  begin
    followup_id := nullif(lead.details #>> '{seguimientoCliente,tarea,tareaId}', '')::uuid;
  exception when invalid_text_representation then
    followup_id := null;
  end;

  update public.crm_opportunities
    set details = jsonb_set(jsonb_set(jsonb_set(details, '{aceptacion}', acceptance, true),
      '{contratacion,decision}', '"Aceptado"', true),
      '{seguimientoCliente}', coalesce(details -> 'seguimientoCliente', '{}'::jsonb)
        || jsonb_build_object('estado', 'aceptado', 'version', acceptance_link.quote_version), true),
      stage = 'won', substage = 'Aceptado', updated_at = now_ts
    where id = lead.id returning * into saved_lead;

  update public.crm_quote_acceptance_links
    set accepted_at = now_ts, acceptor_name = trim(acceptor), acceptor_user_agent = left(coalesce(user_agent, ''), 400)
    where id = acceptance_link.id;
  update public.crm_quote_acceptance_links set revoked_at = now_ts
    where opportunity_id = lead.id and id <> acceptance_link.id and revoked_at is null and accepted_at is null;

  insert into public.crm_opportunity_events (firm_id, opportunity_id, event_type, payload) values
    (lead.firm_id, lead.id, 'acceptance_recorded', jsonb_build_object('acceptance', acceptance, 'recorded_by', null)),
    (lead.firm_id, lead.id, 'stage_changed', jsonb_build_object('from', lead.stage, 'to', 'won', 'substage', 'Aceptado', 'reason', 'Aceptación online'));

  if followup_id is not null then
    update public.crm_tasks set status = 'completed'
      where id = followup_id and firm_id = lead.firm_id and opportunity_id = lead.id
        and status not in ('completed', 'cancelled') returning * into followup;
    if followup.id is not null then
      insert into public.crm_task_events (firm_id, task_id, event_type, payload)
      values (followup.firm_id, followup.id, 'completed',
        jsonb_build_object('result', 'Presupuesto aceptado online por ' || trim(acceptor)));
    end if;
  end if;
  notify_to := coalesce(followup.assigned_to, lead.assigned_to);

  select id into existing_onboarding from public.crm_onboardings where opportunity_id = lead.id;
  if existing_onboarding is null then
    update public.crm_firms set onboarding_sequence = onboarding_sequence + 1 where id = lead.firm_id
      returning onboarding_sequence into onboarding_number;
    insert into public.crm_onboardings (
      firm_id, contact_id, opportunity_id, reference, matter_title, phase, phase_changed_on,
      quote_reference, quote_amount, proforma_sent_on, assigned_to, next_action
    ) values (
      lead.firm_id, lead.contact_id, lead.id,
      'ONB-' || extract(year from current_date)::text || '-' || lpad(onboarding_number::text, 5, '0'),
      lead.title, 'proforma', current_date, coalesce(nullif(acceptance_link.quote_reference, ''), lead.reference),
      case when acceptance_link.total_cents is null then null else acceptance_link.total_cents / 100.0 end,
      null, lead.assigned_to, 'Preparar y enviar proforma'
    );
    insert into public.crm_tasks (
      firm_id, opportunity_id, kind, title, description, priority, due_at, due_on, assigned_to, validation_status
    ) values (
      lead.firm_id, lead.id, 'task', 'Preparar y enviar proforma',
      'Presupuesto ' || acceptance_link.quote_reference || ' v' || acceptance_link.quote_version ||
        ' aceptado online por ' || trim(acceptor) || '. Preparar y enviar la proforma desde onboarding.',
      'high', now_ts + interval '1 day', ((now_ts + interval '1 day') at time zone 'Europe/Madrid')::date,
      lead.assigned_to, 'not_required'
    ) returning * into proforma_task;
  end if;

  if notify_to is not null then
    insert into public.crm_notifications (firm_id, recipient_id, actor_id, actor_name, task_id, task_title, kind, body)
    values (lead.firm_id, notify_to, null, 'Cliente', coalesce(followup.id, proforma_task.id),
      coalesce(followup.title, proforma_task.title, ''), 'task_message',
      left('Presupuesto ' || acceptance_link.quote_reference || ' v' || acceptance_link.quote_version ||
        ' aceptado online por ' || trim(acceptor), 280));
  end if;
  return jsonb_build_object('status', 'accepted', 'already', false, 'acceptedAt', now_ts);
end;
$$;

create or replace function public.crm_rename_acceptance_task()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.title = 'Iniciar onboarding y preparar proforma' then new.title := 'Preparar y enviar proforma'; end if;
  return new;
end;
$$;
drop trigger if exists crm_rename_acceptance_task on public.crm_tasks;
create trigger crm_rename_acceptance_task before insert on public.crm_tasks
  for each row execute function public.crm_rename_acceptance_task();

revoke all on function public.crm_sent_quote_version(jsonb) from public, anon;
revoke all on function public.crm_create_quote_acceptance_link(uuid, integer) from public, anon;
revoke all on function public.crm_revoke_quote_acceptance_link(uuid) from public, anon;
revoke all on function public.crm_public_quote_acceptance(text) from public, anon, authenticated;
revoke all on function public.crm_public_accept_quote(text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.crm_sent_quote_version(jsonb) to authenticated;
grant execute on function public.crm_create_quote_acceptance_link(uuid, integer) to authenticated;
grant execute on function public.crm_revoke_quote_acceptance_link(uuid) to authenticated;
grant execute on function public.crm_public_quote_acceptance(text) to anon, authenticated;
grant execute on function public.crm_public_accept_quote(text, text, boolean, text) to anon, authenticated;

notify pgrst, 'reload schema';