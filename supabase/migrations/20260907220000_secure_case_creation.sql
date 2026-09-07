-- Case numbers are internal firm sequencing state. The trigger must be able to
-- update it for every active firm member, not only firm owners and admins.
create or replace function public.crm_assign_case_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.crm_is_firm_member(new.firm_id) then
    raise exception 'No tienes permiso para crear expedientes en este despacho';
  end if;

  if new.case_number is null then
    update public.crm_firms
    set case_sequence = case_sequence + 1
    where id = new.firm_id
    returning case_sequence into new.case_number;
  end if;

  if new.case_number is null then
    raise exception 'No se pudo asignar la referencia del expediente';
  end if;

  return new;
end;
$$;

revoke all on function public.crm_assign_case_number() from public, anon, authenticated;

-- Keep all case-creation validation and the sequence allocation in one
-- authorized transaction. Direct table inserts are intentionally not exposed.
create or replace function public.crm_create_case(
  target_firm_id uuid,
  target_contact_id uuid,
  target_opportunity_id uuid,
  new_title text,
  new_area text,
  new_matter_type text,
  new_nature text,
  new_priority public.crm_priority,
  new_assigned_to uuid,
  new_opened_on date,
  new_next_action text,
  new_current_position text
)
returns public.crm_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_case public.crm_cases;
begin
  if auth.uid() is null or not public.crm_is_firm_member(target_firm_id) then
    raise exception 'No tienes permiso para crear expedientes en este despacho';
  end if;
  if target_contact_id is null or not exists (
    select 1 from public.crm_contacts
    where id = target_contact_id and firm_id = target_firm_id
  ) then
    raise exception 'Selecciona un contacto válido del despacho';
  end if;
  if target_opportunity_id is not null and not exists (
    select 1 from public.crm_opportunities
    where id = target_opportunity_id and firm_id = target_firm_id
  ) then
    raise exception 'La oportunidad seleccionada no pertenece al despacho';
  end if;
  if new_assigned_to is not null and not exists (
    select 1 from public.crm_firm_members
    where firm_id = target_firm_id and user_id = new_assigned_to and status = 'active'
  ) then
    raise exception 'El responsable debe ser un miembro activo del despacho';
  end if;
  if nullif(trim(new_title), '') is null or char_length(trim(new_title)) > 300 then
    raise exception 'Indica un asunto de entre 1 y 300 caracteres';
  end if;
  if new_nature not in ('judicial', 'extrajudicial') then
    raise exception 'Selecciona la naturaleza del expediente';
  end if;
  if new_priority is null then
    raise exception 'Selecciona una prioridad';
  end if;
  if new_opened_on is null then
    raise exception 'Indica la fecha de apertura';
  end if;

  insert into public.crm_cases (
    firm_id, primary_contact_id, opportunity_id, title, area, matter_type,
    nature, priority, assigned_to, opened_on, next_action, current_position
  ) values (
    target_firm_id, target_contact_id, target_opportunity_id, trim(new_title),
    trim(coalesce(new_area, '')), trim(coalesce(new_matter_type, '')), new_nature,
    new_priority, new_assigned_to, new_opened_on, trim(coalesce(new_next_action, '')),
    trim(coalesce(new_current_position, ''))
  ) returning * into saved_case;

  return saved_case;
end;
$$;

revoke insert on public.crm_cases from authenticated;
revoke all on function public.crm_create_case(uuid, uuid, uuid, text, text, text, text, public.crm_priority, uuid, date, text, text) from public, anon;
grant execute on function public.crm_create_case(uuid, uuid, uuid, text, text, text, text, public.crm_priority, uuid, date, text, text) to authenticated;

notify pgrst, 'reload schema';