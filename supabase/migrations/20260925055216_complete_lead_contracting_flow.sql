create or replace function public.crm_save_opportunity_details(
  target_opportunity_id uuid,
  target_expected_version integer,
  new_details jsonb,
  transition_stage public.crm_opportunity_stage,
  transition_substage text,
  transition_reason text
)
returns public.crm_opportunities
language plpgsql
security definer
set search_path = public
as $$
declare
  current_opportunity public.crm_opportunities;
  saved_opportunity public.crm_opportunities;
  previous_quote jsonb;
  next_quote jsonb;
  previous_engagement jsonb;
  next_engagement jsonb;
  previous_stage public.crm_opportunity_stage;
  transition_allowed boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if target_expected_version is null or target_expected_version < 1 then
    raise exception 'A valid expected version is required';
  end if;
  if jsonb_typeof(new_details) <> 'object' or octet_length(new_details::text) > 50000 then
    raise exception 'Opportunity details must be an object no larger than 50 KB';
  end if;

  select * into current_opportunity from public.crm_opportunities where id = target_opportunity_id for update;
  if not found then raise exception 'Opportunity not found'; end if;
  if not public.crm_is_firm_member(current_opportunity.firm_id) then raise exception 'Forbidden'; end if;
  if current_opportunity.version <> target_expected_version then
    raise exception 'Opportunity changed by another user; reload before saving' using errcode = '40001';
  end if;

  previous_quote := coalesce(current_opportunity.details -> 'presupuesto', '{}'::jsonb);
  next_quote := coalesce(new_details -> 'presupuesto', '{}'::jsonb);
  previous_engagement := coalesce(current_opportunity.details -> 'contratacion', '{}'::jsonb);
  next_engagement := coalesce(new_details -> 'contratacion', '{}'::jsonb);
  if previous_quote ->> 'version' is distinct from next_quote ->> 'version' then
    if next_quote ->> 'estado' = 'Validado' then
      raise exception 'A changed quote version needs a new review';
    end if;
    next_quote := next_quote || jsonb_build_object('validadoVersion', null, 'validadoPor', null, 'fechaValidacion', null);
    new_details := jsonb_set(new_details, '{presupuesto}', next_quote, true);
  end if;
  if next_quote ->> 'estado' = 'Validado'
    and (next_quote ->> 'validadoVersion')::integer is distinct from nullif(next_quote ->> 'version', '')::integer
    and not public.crm_has_firm_role(current_opportunity.firm_id, array['owner', 'admin']::public.crm_member_role[])
  then raise exception 'Only firm owners and admins can validate a quote'; end if;
  if next_quote ->> 'estado' = 'Enviado al cliente' then
    if previous_quote ->> 'estado' <> 'Validado'
      or (previous_quote ->> 'validadoVersion')::integer is distinct from (previous_quote ->> 'version')::integer
      or (next_quote ->> 'versionEnviada')::integer is distinct from (previous_quote ->> 'version')::integer
      or nullif(trim(next_quote ->> 'destinatario'), '') is null
      or nullif(trim(next_quote ->> 'canal'), '') is null
      or nullif(trim(next_quote ->> 'fechaEnvio'), '') is null
    then raise exception 'The current approved quote, recipient, channel and actual send date are required'; end if;
  end if;

  if transition_stage is not null then
    if transition_stage = current_opportunity.stage then raise exception 'The opportunity is already in this stage'; end if;
    if transition_stage = 'lost' and nullif(trim(transition_reason), '') is null then
      raise exception 'A reason is required to close a Lead as lost';
    end if;
    if next_engagement ->> 'decision' = 'Rechazado'
      and nullif(trim(next_engagement ->> 'motivoRechazo'), '') is null then
      raise exception 'A rejection reason is required';
    end if;
    transition_allowed := case current_opportunity.stage
      when 'entry' then transition_stage in ('qualification', 'lost')
      when 'qualification' then transition_stage in ('entry', 'first_meeting', 'lost')
      when 'first_meeting' then transition_stage in ('qualification', 'quote', 'lost')
      when 'quote' then transition_stage in ('first_meeting', 'validation', 'lost')
      when 'validation' then transition_stage in ('quote', 'engagement', 'lost')
      when 'engagement' then transition_stage in ('validation', 'won', 'lost')
      else false
    end;
    if not transition_allowed then raise exception 'Invalid stage transition'; end if;
    if transition_stage = 'engagement' and next_quote ->> 'estado' <> 'Enviado al cliente' then
      raise exception 'A Lead can enter client engagement only after a quote was sent';
    end if;
    if transition_stage = 'won' and not (
      new_details -> 'aceptacion' ->> 'fecha' is not null
      and (new_details -> 'aceptacion' ->> 'version')::integer = (next_quote ->> 'versionEnviada')::integer
      and next_engagement ->> 'decision' = 'Aceptado verbalmente'
    ) then raise exception 'A Lead can be accepted only after the sent quote version and client acceptance are recorded'; end if;
  end if;

  if current_opportunity.details = new_details and transition_stage is null then return current_opportunity; end if;
  previous_stage := current_opportunity.stage;
  update public.crm_opportunities
  set details = new_details,
      stage = coalesce(transition_stage, current_opportunity.stage),
      substage = case when transition_stage is not null then coalesce(nullif(trim(transition_substage), ''), 'Sin revisar') else current_opportunity.substage end
  where id = current_opportunity.id returning * into saved_opportunity;

  insert into public.crm_opportunity_events (firm_id, opportunity_id, event_type, payload)
  values (saved_opportunity.firm_id, saved_opportunity.id, 'qualification_updated', jsonb_build_object('previous_version', current_opportunity.version));
  if previous_quote ->> 'estado' is distinct from next_quote ->> 'estado' and next_quote ->> 'estado' = 'Validado' then
    insert into public.crm_opportunity_events (firm_id, opportunity_id, event_type, payload)
    values (saved_opportunity.firm_id, saved_opportunity.id, 'quote_approval_recorded', jsonb_build_object('reviewer_id', auth.uid(), 'version', next_quote -> 'validadoVersion', 'reviewer_role', case when public.crm_has_firm_role(current_opportunity.firm_id, array['owner']::public.crm_member_role[]) then 'owner' else 'admin' end));
  end if;
  if previous_quote ->> 'estado' is distinct from next_quote ->> 'estado' and next_quote ->> 'estado' = 'Enviado al cliente' then
    insert into public.crm_opportunity_events (firm_id, opportunity_id, event_type, payload)
    values (saved_opportunity.firm_id, saved_opportunity.id, 'quote_sent_recorded', jsonb_build_object('recipient', next_quote ->> 'destinatario', 'channel', next_quote ->> 'canal', 'sent_at', next_quote ->> 'fechaEnvio', 'version', next_quote -> 'versionEnviada', 'recorded_by', auth.uid()));
  end if;
  if previous_engagement is distinct from next_engagement then
    insert into public.crm_opportunity_events (firm_id, opportunity_id, event_type, payload)
    values (saved_opportunity.firm_id, saved_opportunity.id, 'engagement_updated', jsonb_build_object('decision', next_engagement -> 'decision', 'motivoRechazo', next_engagement -> 'motivoRechazo', 'negociacion', next_engagement -> 'negociacion', 'hojaEncargo', next_engagement -> 'hojaEncargo', 'proforma', next_engagement -> 'proforma', 'pago', next_engagement -> 'pago', 'fechaSeguimiento', next_engagement -> 'fechaSeguimiento'));
  end if;
  if previous_quote ->> 'rectificacion' is distinct from next_quote ->> 'rectificacion'
    and nullif(trim(next_quote ->> 'rectificacion'), '') is not null then
    insert into public.crm_opportunity_events (firm_id, opportunity_id, event_type, payload)
    values (saved_opportunity.firm_id, saved_opportunity.id, 'quote_revision_requested', jsonb_build_object('request', next_quote ->> 'rectificacion', 'new_version', next_quote -> 'version', 'recorded_by', auth.uid()));
  end if;
  if current_opportunity.details -> 'aceptacion' is distinct from new_details -> 'aceptacion' and new_details ? 'aceptacion' then
    insert into public.crm_opportunity_events (firm_id, opportunity_id, event_type, payload)
    values (saved_opportunity.firm_id, saved_opportunity.id, 'acceptance_recorded', jsonb_build_object('acceptance', new_details -> 'aceptacion', 'recorded_by', auth.uid()));
  end if;
  if transition_stage is not null then
    insert into public.crm_opportunity_events (firm_id, opportunity_id, event_type, payload)
    values (saved_opportunity.firm_id, saved_opportunity.id, 'stage_changed', jsonb_build_object('from', previous_stage, 'to', transition_stage, 'substage', saved_opportunity.substage, 'reason', nullif(trim(transition_reason), '')));
  end if;
  return saved_opportunity;
end;
$$;

revoke all on function public.crm_save_opportunity_details(uuid, integer, jsonb, public.crm_opportunity_stage, text, text) from public, anon;
grant execute on function public.crm_save_opportunity_details(uuid, integer, jsonb, public.crm_opportunity_stage, text, text) to authenticated;