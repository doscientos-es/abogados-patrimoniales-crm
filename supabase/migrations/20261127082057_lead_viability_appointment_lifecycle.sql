-- Booking is defined by the special-meeting lifecycle, not just the task status.
create or replace function public.crm_guard_lead_viability_tasks()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  state jsonb;
  new_booked boolean;
  old_booked boolean := false;
begin
  if tg_op in ('INSERT','UPDATE') then
    if new.opportunity_id is not null and new.case_id is null and new.meeting_details ->> 'specialType'='meeting' then
      select details -> 'viabilidadInicial' into state from public.crm_opportunities where id=new.opportunity_id and firm_id=new.firm_id;
      if state ->> 'flujo'='2' then
        new_booked := coalesce(new.meeting_details ->> 'status',case when new.due_at is null then 'preparation' else 'scheduled' end)
          in ('scheduled','in_progress') and new.status not in ('completed','cancelled');
        if tg_op='UPDATE' then
          old_booked := coalesce(old.meeting_details ->> 'status',case when old.due_at is null then 'preparation' else 'scheduled' end)
            in ('scheduled','in_progress') and old.status not in ('completed','cancelled')
            and old.meeting_details ->> 'specialType'='meeting';
        end if;
        if new_booked and (not coalesce(old_booked,false) or old.due_at is distinct from new.due_at
          or old.assigned_to is distinct from new.assigned_to) then
          if state ->> 'resultado' is distinct from 'apto' or not (state ? 'conflictoRevisadoEn')
            then raise exception 'Revisa y registra el conflicto de intereses en la ficha del Lead antes de concertar la primera cita'; end if;
          if new.due_at is null or new.assigned_to is null then raise exception 'La cita necesita fecha y responsable'; end if;
        end if;
        if new.meeting_details ->> 'meetingType'='Primera cita' then
          if new_booked and not coalesce(old_booked,false) then
            update public.crm_tasks set is_next_action=false
              where firm_id=new.firm_id and opportunity_id=new.opportunity_id and id<>new.id and is_next_action
                and status in ('pending','in_progress','waiting');
            new.is_next_action := true;
          elsif not new_booked and old_booked then
            new.is_next_action := false;
          end if;
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
          and coalesce(t.meeting_details ->> 'status','scheduled') in ('scheduled','in_progress')
      ) then raise exception 'Mantén el aviso activo hasta concertar una primera cita'; end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.crm_finish_lead_booking_on_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare state jsonb;
begin
  if new.opportunity_id is null or new.case_id is not null or not new.is_next_action or new.due_at is null
    or new.status in ('completed','cancelled') or coalesce(new.meeting_details ->> 'status','scheduled') not in ('scheduled','in_progress')
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

drop trigger crm_finish_lead_booking_on_insert on public.crm_tasks;
create trigger crm_finish_lead_booking_on_insert
  after insert or update of meeting_details on public.crm_tasks
  for each row execute function public.crm_finish_lead_booking_on_insert();

create or replace function public.crm_restore_lead_booking_on_cancel()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  state jsonb;
  fallback_owner uuid;
begin
  if not ((new.status='cancelled' and old.status<>'cancelled') or
      (coalesce(new.meeting_details ->> 'status','') in ('preparation','cancelled','not_held')
       and coalesce(old.meeting_details ->> 'status','scheduled') in ('scheduled','in_progress')
       and old.due_at is not null))
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
        and t.meeting_details ->> 'specialType'='meeting' and t.meeting_details ->> 'meetingType'='Primera cita'
        and coalesce(t.meeting_details ->> 'status','scheduled') in ('scheduled','in_progress'))
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

drop trigger crm_restore_lead_booking_on_cancel on public.crm_tasks;
create trigger crm_restore_lead_booking_on_cancel
  after update of status, meeting_details on public.crm_tasks
  for each row execute function public.crm_restore_lead_booking_on_cancel();

notify pgrst, 'reload schema';
