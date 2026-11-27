-- Keep the existing 15-day no-show workflow as the single follow-up.
create or replace function public.crm_restore_lead_booking_on_cancel()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  state jsonb;
  fallback_owner uuid;
begin
  if not ((new.status='cancelled' and old.status<>'cancelled') or
      (coalesce(new.meeting_details ->> 'status','') in ('preparation','cancelled')
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
