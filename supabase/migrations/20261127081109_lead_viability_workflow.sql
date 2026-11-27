-- Opt-in workflow for newly created Leads. Existing dossiers keep their current state.
create function public.crm_create_viable_lead(
  p_request_id uuid, p_firm uuid, p_contact uuid, p_title text, p_area text,
  p_source text, p_description text, p_owner uuid, p_due date, p_details jsonb,
  p_accept_deadline_warning boolean
) returns public.crm_opportunities
language plpgsql security definer set search_path = '' as $$
declare
  lead public.crm_opportunities;
  task public.crm_tasks;
  actor uuid := auth.uid();
  choice text := p_details #>> '{viabilidadInicial,resultado}';
  reason text := p_details #>> '{viabilidadInicial,motivo}';
  urgent boolean := coalesce(p_details #>> '{urgencia,opcion}' = 'Sí, existe una fecha o plazo concreto', false);
  action_kind text;
  due_at timestamptz;
begin
  if actor is null or not public.crm_is_firm_member(p_firm) then raise exception 'Acceso no autorizado' using errcode = '42501'; end if;
  select * into lead from public.crm_opportunities where id = p_request_id;
  if found then
    if lead.firm_id <> p_firm or lead.created_by is distinct from actor then raise exception 'Acceso no autorizado' using errcode = '42501'; end if;
    return lead;
  end if;
  if choice is null or choice not in ('apto', 'pendiente', 'no_apto') then raise exception 'Indica la viabilidad del Lead'; end if;
  if p_due is null or p_due < (now() at time zone 'Europe/Madrid')::date then raise exception 'Indica una fecha de seguimiento válida'; end if;
  if not exists (select 1 from public.crm_firm_members m where m.firm_id=p_firm and m.user_id=p_owner and m.status='active')
    then raise exception 'Selecciona un responsable activo del despacho'; end if;
  if choice = 'no_apto' and (coalesce(trim(reason), '') = '' or length(trim(reason)) > 1000) then raise exception 'Indica un motivo de no aceptación'; end if;
  if choice = 'no_apto' and urgent and p_accept_deadline_warning is distinct from true
    then raise exception 'Confirma el aviso sobre el plazo antes de cerrar el Lead'; end if;
  due_at := (p_due + time '17:00') at time zone 'Europe/Madrid';
  action_kind := case choice when 'apto' then 'book' when 'pendiente' then 'review' else 'notify' end;
  insert into public.crm_opportunities (
    id, firm_id, contact_id, title, area, source, description, assigned_to, details
  ) values (
    p_request_id, p_firm, p_contact, trim(p_title), coalesce(p_area,''), coalesce(p_source,''), coalesce(p_description,''), p_owner,
    (p_details - 'viabilidadInicial') || jsonb_build_object('viabilidadInicial', jsonb_strip_nulls(jsonb_build_object(
      'flujo', 2, 'resultado', choice, 'motivo', case when choice='no_apto' then trim(reason) end,
      'decididaEn', now(), 'decididaPor', actor,
      'avisoPlazoConfirmadoEn', case when choice='no_apto' and urgent then now() end,
      'comunicacionEstado', case when choice='no_apto' then 'pendiente' end
    )))
  ) on conflict (id) do nothing returning * into lead;
  if not found then
    select * into lead from public.crm_opportunities where id=p_request_id;
    if lead.firm_id is distinct from p_firm or lead.created_by is distinct from actor then raise exception 'Acceso no autorizado' using errcode = '42501'; end if;
    return lead;
  end if;
  if choice = 'no_apto' then
    perform public.crm_transition_opportunity(lead.id, 'lost', 'No apto / no atendible', 'Viabilidad inicial: ' || trim(reason));
  else
    perform public.crm_transition_opportunity(lead.id, 'qualification', case when choice='pendiente' then 'Pendiente de revisión' else 'Revisada' end, 'Viabilidad inicial');
    if choice='apto' then
      perform public.crm_transition_opportunity(lead.id, 'first_meeting', 'Apto para primera cita', 'Viabilidad inicial');
    end if;
  end if;
  task := public.crm_create_task(p_firm, null, lead.id,
    case when action_kind='review' then 'task' else 'reminder' end,
    case action_kind when 'review' then 'REVISAR VIABILIDAD' when 'book' then 'CONCERTAR PRIMERA CITA' else 'COMUNICAR NO ACEPTACIÓN' end,
    case when action_kind='notify' and urgent then 'Existe un plazo concreto. Revisa el plazo comunicado y deja constancia del aviso al contacto.' else '' end,
    case when action_kind='notify' and urgent then 'high'::public.crm_priority else 'medium'::public.crm_priority end,
    due_at, due_at, p_owner, null, null, null, jsonb_build_object('leadViabilityAction',action_kind), null, action_kind='notify' and urgent);
  perform public.crm_set_next_action(task.id,task.version,true);
  update public.crm_opportunities set details=jsonb_set(details,'{viabilidadInicial,tareaId}',to_jsonb(task.id))
    where id=lead.id returning * into lead;
  return lead;
end;
$$;

create function public.crm_act_on_lead_viability(
  p_lead uuid, p_version int, p_action text, p_result text default null,
  p_due date default null, p_reason text default null, p_channel text default null,
  p_accept_deadline_warning boolean default false
) returns public.crm_opportunities
language plpgsql security definer set search_path = '' as $$
declare
  lead public.crm_opportunities;
  prior public.crm_tasks;
  next_task public.crm_tasks;
  actor uuid := auth.uid();
  state jsonb;
  urgent boolean;
  action_kind text;
  due_at timestamptz;
begin
  select * into lead from public.crm_opportunities where id=p_lead for update;
  if not found or actor is null or not public.crm_is_firm_member(lead.firm_id)
    then raise exception 'Acceso no autorizado' using errcode = '42501'; end if;
  if lead.archived_at is not null then raise exception 'El Lead está archivado'; end if;
  if lead.version <> p_version then raise exception 'El Lead ha cambiado. Recarga antes de guardar' using errcode = '40001'; end if;
  state := lead.details -> 'viabilidadInicial';
  if state ->> 'flujo' is distinct from '2' then raise exception 'Este Lead no usa el nuevo flujo de viabilidad'; end if;
  select * into prior from public.crm_tasks
    where id=(state ->> 'tareaId')::uuid and opportunity_id=lead.id and firm_id=lead.firm_id for update;
  if not found or (prior.assigned_to is distinct from actor and lead.assigned_to is distinct from actor
    and not public.crm_task_actor_can_manage(prior))
    then raise exception 'Solo puede actuar el responsable o un usuario autorizado' using errcode = '42501'; end if;
  urgent := coalesce(lead.details #>> '{urgencia,opcion}' = 'Sí, existe una fecha o plazo concreto',false);

  if p_action='confirm_conflict_check' and state ->> 'resultado'='apto' then
    if state ? 'conflictoRevisadoEn' then return lead; end if;
    state := state || jsonb_build_object('conflictoRevisadoEn',now(),'conflictoRevisadoPor',actor);
  elsif p_action='confirm_notice' and state ->> 'resultado'='no_apto' then
    if state ->> 'comunicacionEstado'='enviada' then return lead; end if;
    if p_channel is null or p_channel not in ('email','whatsapp') then raise exception 'Indica el canal utilizado'; end if;
    state := state || jsonb_build_object('comunicacionEstado','enviada','comunicado_fecha',now(),'comunicado_via',p_channel,'comunicado_por',actor);
  elsif p_action='review' and (
    (state ->> 'resultado'='pendiente' and lead.stage='qualification') or
    (state ->> 'resultado'='apto' and lead.stage='first_meeting' and not exists (
      select 1 from public.crm_tasks t where t.opportunity_id=lead.id and t.case_id is null
      and t.status <> 'cancelled' and t.meeting_details ->> 'specialType'='meeting'
      and t.meeting_details ->> 'meetingType'='Primera cita'))
  ) then
    if p_result is null or p_result not in ('apto','pendiente','no_apto') then raise exception 'Indica el resultado de la revisión'; end if;
    if p_due is null or p_due < (now() at time zone 'Europe/Madrid')::date
      then raise exception 'Indica la fecha de la siguiente acción'; end if;
    if not exists (select 1 from public.crm_firm_members m
      where m.firm_id=lead.firm_id and m.user_id=coalesce(lead.assigned_to,prior.assigned_to) and m.status='active')
      then raise exception 'Selecciona un responsable activo en la ficha del Lead'; end if;
    if p_result='no_apto' and (nullif(trim(p_reason),'') is null or length(p_reason)>1000)
      then raise exception 'Indica el motivo de no aceptación'; end if;
    if p_result='no_apto' and urgent and p_accept_deadline_warning is distinct from true
      then raise exception 'Confirma el aviso sobre el plazo antes de cerrar el Lead'; end if;
    action_kind := case p_result when 'apto' then 'book' when 'pendiente' then 'review' else 'notify' end;
    due_at := (p_due + time '17:00') at time zone 'Europe/Madrid';
    next_task := public.crm_create_task(lead.firm_id, null, lead.id,
      case when action_kind='review' then 'task' else 'reminder' end,
      case action_kind when 'review' then 'REVISAR VIABILIDAD' when 'book' then 'CONCERTAR PRIMERA CITA' else 'COMUNICAR NO ACEPTACIÓN' end,
      case when action_kind='notify' and urgent then 'Existe un plazo concreto. Revisa el plazo comunicado y deja constancia del aviso al contacto.' else '' end,
      case when action_kind='notify' and urgent then 'high'::public.crm_priority else 'medium'::public.crm_priority end,
      due_at,due_at,coalesce(lead.assigned_to,prior.assigned_to),null,null,null,jsonb_build_object('leadViabilityAction',action_kind),null,action_kind='notify' and urgent);
    state := (state - 'conflictoRevisadoEn' - 'conflictoRevisadoPor') || jsonb_strip_nulls(jsonb_build_object('resultado',p_result,'tareaId',next_task.id,'decididaEn',now(),'decididaPor',actor,
      'motivo',case when p_result='no_apto' then trim(p_reason) end,
      'comunicacionEstado',case when p_result='no_apto' then 'pendiente' end,
      'avisoPlazoConfirmadoEn',case when p_result='no_apto' and urgent then now() end));
    if p_result='apto' and lead.stage<>'first_meeting' then
      perform public.crm_transition_opportunity(lead.id,'first_meeting','Apto para primera cita','Revisión de viabilidad');
    elsif p_result='no_apto' then
      perform public.crm_transition_opportunity(lead.id,'lost','No apto / no atendible','Revisión de viabilidad: ' || trim(p_reason));
    elsif p_result='pendiente' and lead.stage<>'qualification' then
      perform public.crm_transition_opportunity(lead.id,'qualification','Pendiente de revisión','Revisión de viabilidad');
    end if;
  else raise exception 'Esta acción no corresponde al estado actual del Lead';
  end if;

  update public.crm_opportunities set details=jsonb_set(details,'{viabilidadInicial}',state)
    where id=p_lead returning * into lead;
  if p_action in ('review','confirm_notice') and prior.status not in ('completed','cancelled') then
    update public.crm_tasks set status='completed', is_next_action=false, completed_at=now(),
      completion_result=case when p_action='review' then 'Revisión de viabilidad: ' || (state ->> 'resultado') else 'Comunicación registrada' end where id=prior.id;
    insert into public.crm_task_events(firm_id,task_id,event_type,payload)
      values(lead.firm_id,prior.id,'completed',jsonb_build_object('viabilidad',state ->> 'resultado','origen','viabilidad_lead'));
  end if;
  if p_action='review' then perform public.crm_set_next_action(next_task.id,next_task.version,true); end if;
  insert into public.crm_opportunity_events(firm_id,opportunity_id,event_type,payload)
    values(lead.firm_id,lead.id,'lead_viability_changed',jsonb_strip_nulls(jsonb_build_object('accion',p_action,'resultado',state ->> 'resultado','canal',p_channel)));
  return lead;
end;
$$;

create function public.crm_guard_lead_viability_tasks()
returns trigger language plpgsql security definer set search_path = '' as $$
declare state jsonb;
begin
  if tg_op in ('INSERT','UPDATE') then
    if new.opportunity_id is not null and new.case_id is null and new.meeting_details ->> 'specialType'='meeting'
      and new.status not in ('completed','cancelled')
      and (tg_op='INSERT' or old.meeting_details ->> 'specialType' is distinct from 'meeting'
        or old.status in ('completed','cancelled') or old.due_at is distinct from new.due_at
        or old.assigned_to is distinct from new.assigned_to) then
      select details -> 'viabilidadInicial' into state from public.crm_opportunities where id=new.opportunity_id and firm_id=new.firm_id;
      if state ->> 'flujo'='2' then
        if state ->> 'resultado' is distinct from 'apto' or not (state ? 'conflictoRevisadoEn')
          then raise exception 'Revisa y registra el conflicto de intereses en la ficha del Lead antes de concertar la primera cita'; end if;
        if new.due_at is null or new.assigned_to is null then raise exception 'La cita necesita fecha y responsable'; end if;
        if tg_op='INSERT' and new.meeting_details ->> 'meetingType'='Primera cita' then
          update public.crm_tasks set is_next_action=false
            where firm_id=new.firm_id and opportunity_id=new.opportunity_id and is_next_action
              and status in ('pending','in_progress','waiting');
          new.is_next_action := true;
        end if;
      end if;
    end if;
    if tg_op='INSERT' then return new; end if;
  end if;

  if old.opportunity_id is null or old.meeting_details ->> 'leadViabilityAction' is null then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  select details -> 'viabilidadInicial' into state from public.crm_opportunities where id=old.opportunity_id and firm_id=old.firm_id;
  if state ->> 'tareaId'=old.id::text then
    if tg_op='DELETE' then raise exception 'Esta tarea se gestiona desde Viabilidad inicial en la ficha del Lead'; end if;
    if new.due_at is null or new.assigned_to is null then raise exception 'La siguiente acción requiere fecha y responsable'; end if;
    if new.meeting_details ->> 'leadViabilityAction' is distinct from old.meeting_details ->> 'leadViabilityAction'
      then raise exception 'No se puede cambiar el tipo de seguimiento del Lead'; end if;
    if new.status in ('cancelled','completed') and old.status is distinct from new.status then
      if state ->> 'resultado'='pendiente' then raise exception 'Reclasifica el Lead desde su ficha antes de cerrar la revisión'; end if;
      if state ->> 'resultado'='no_apto' and state ->> 'comunicacionEstado' is distinct from 'enviada'
        then raise exception 'Registra la comunicación en la ficha del Lead antes de cerrar el aviso'; end if;
      if state ->> 'resultado'='apto' and not exists(
        select 1 from public.crm_tasks t where t.opportunity_id=old.opportunity_id and t.firm_id=old.firm_id
          and t.status not in ('cancelled','completed') and t.due_at is not null and t.assigned_to is not null
          and t.meeting_details ->> 'specialType'='meeting' and t.meeting_details ->> 'meetingType'='Primera cita'
      ) then raise exception 'Mantén el aviso activo hasta concertar una primera cita'; end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

create trigger crm_guard_lead_viability_tasks
  before insert or update or delete on public.crm_tasks
  for each row execute function public.crm_guard_lead_viability_tasks();

create function public.crm_finish_lead_booking_on_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare state jsonb;
begin
  if new.opportunity_id is null or new.case_id is not null or not new.is_next_action
    or new.meeting_details ->> 'specialType' is distinct from 'meeting'
    or new.meeting_details ->> 'meetingType' is distinct from 'Primera cita' then return new; end if;
  select details -> 'viabilidadInicial' into state from public.crm_opportunities
    where id=new.opportunity_id and firm_id=new.firm_id;
  if state ->> 'flujo'='2' and state ->> 'resultado'='apto' then
    update public.crm_tasks set status='completed', completed_at=now(), completion_result='Primera cita concertada'
      where id=(state ->> 'tareaId')::uuid and firm_id=new.firm_id and opportunity_id=new.opportunity_id
        and meeting_details ->> 'leadViabilityAction'='book' and status in ('pending','in_progress','waiting');
  end if;
  return new;
end;
$$;

create trigger crm_finish_lead_booking_on_insert
  after insert on public.crm_tasks
  for each row execute function public.crm_finish_lead_booking_on_insert();

revoke all on function public.crm_finish_lead_booking_on_insert() from public, anon, authenticated;

-- If the only first appointment is cancelled, the booking fallback becomes active again.
create function public.crm_restore_lead_booking_on_cancel()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  state jsonb;
  fallback_owner uuid;
begin
  if new.status is distinct from 'cancelled' or old.status='cancelled'
    or new.opportunity_id is null or new.case_id is not null
    or new.meeting_details ->> 'specialType' is distinct from 'meeting'
    or new.meeting_details ->> 'meetingType' is distinct from 'Primera cita' then return new; end if;
  select o.details -> 'viabilidadInicial', coalesce(owner.user_id, actor.user_id)
    into state,fallback_owner from public.crm_opportunities o
    left join public.crm_firm_members owner on owner.firm_id=o.firm_id and owner.user_id=o.assigned_to and owner.status='active'
    left join public.crm_firm_members actor on actor.firm_id=o.firm_id and actor.user_id=auth.uid() and actor.status='active'
    where o.id=new.opportunity_id and o.firm_id=new.firm_id and o.archived_at is null and o.stage='first_meeting';
  if fallback_owner is not null and state ->> 'flujo'='2' and state ->> 'resultado'='apto'
    and not exists (select 1 from public.crm_tasks t
      where t.opportunity_id=new.opportunity_id and t.case_id is null and t.id<>new.id
        and t.status not in ('completed','cancelled') and t.due_at is not null and t.assigned_to is not null
        and t.meeting_details ->> 'specialType'='meeting' and t.meeting_details ->> 'meetingType'='Primera cita')
  then
    update public.crm_tasks set status='pending', completed_at=null, completion_result='', assigned_to=fallback_owner,
      is_next_action=not exists(select 1 from public.crm_tasks t
        where t.opportunity_id=new.opportunity_id and t.firm_id=new.firm_id and t.id<>new.id
          and t.is_next_action and t.status in ('pending','in_progress','waiting'))
      where id=(state ->> 'tareaId')::uuid and firm_id=new.firm_id and opportunity_id=new.opportunity_id
        and meeting_details ->> 'leadViabilityAction'='book' and status in ('completed','cancelled');
  end if;
  return new;
end;
$$;

create trigger crm_restore_lead_booking_on_cancel
  after update of status on public.crm_tasks
  for each row execute function public.crm_restore_lead_booking_on_cancel();

revoke all on function public.crm_restore_lead_booking_on_cancel() from public, anon, authenticated;
revoke all on function public.crm_create_viable_lead(uuid,uuid,uuid,text,text,text,text,uuid,date,jsonb,boolean) from public, anon;
revoke all on function public.crm_act_on_lead_viability(uuid,int,text,text,date,text,text,boolean) from public, anon;
revoke all on function public.crm_guard_lead_viability_tasks() from public, anon, authenticated;
grant execute on function public.crm_create_viable_lead(uuid,uuid,uuid,text,text,text,text,uuid,date,jsonb,boolean) to authenticated;
grant execute on function public.crm_act_on_lead_viability(uuid,int,text,text,date,text,text,boolean) to authenticated;
notify pgrst, 'reload schema';
