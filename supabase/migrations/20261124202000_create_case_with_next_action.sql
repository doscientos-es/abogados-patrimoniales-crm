-- Create the first actionable task in the same transaction as the case.
create or replace function public.crm_create_case(
  target_firm_id uuid, target_contact_id uuid, target_opportunity_id uuid,
  new_title text, new_area text, new_matter_type text, new_nature text,
  new_priority public.crm_priority, new_assigned_to uuid, new_opened_on date,
  new_next_action text, new_current_position text
)
returns public.crm_cases language plpgsql security definer set search_path = public as $$
declare
  saved_case public.crm_cases;
  first_task public.crm_tasks;
begin
  if auth.uid() is null or not public.crm_is_firm_member(target_firm_id) then
    raise exception 'No tienes permiso para crear expedientes en este despacho';
  end if;
  if target_contact_id is null or not exists (
    select 1 from public.crm_contacts where id = target_contact_id and firm_id = target_firm_id
  ) then raise exception 'Selecciona un contacto válido del despacho'; end if;
  if target_opportunity_id is not null and not exists (
    select 1 from public.crm_opportunities where id = target_opportunity_id and firm_id = target_firm_id
  ) then raise exception 'La oportunidad seleccionada no pertenece al despacho'; end if;
  if new_assigned_to is not null and not exists (
    select 1 from public.crm_firm_members
    where firm_id = target_firm_id and user_id = new_assigned_to and status = 'active'
  ) then raise exception 'El responsable debe ser un miembro activo del despacho'; end if;
  if nullif(trim(new_title), '') is null or char_length(trim(new_title)) > 300 then
    raise exception 'Indica un asunto de entre 1 y 300 caracteres';
  end if;
  if new_nature not in ('judicial', 'extrajudicial') then raise exception 'Selecciona la naturaleza del expediente'; end if;
  if new_priority is null then raise exception 'Selecciona una prioridad'; end if;
  if new_opened_on is null then raise exception 'Indica la fecha de apertura'; end if;

  insert into public.crm_cases (
    firm_id, primary_contact_id, opportunity_id, title, area, matter_type,
    nature, priority, assigned_to, opened_on, next_action, current_position
  ) values (
    target_firm_id, target_contact_id, target_opportunity_id, trim(new_title),
    trim(coalesce(new_area, '')), trim(coalesce(new_matter_type, '')), new_nature,
    new_priority, new_assigned_to, new_opened_on, trim(coalesce(new_next_action, '')),
    trim(coalesce(new_current_position, ''))
  ) returning * into saved_case;

  if nullif(trim(new_next_action), '') is not null then
    first_task := public.crm_create_task(
      target_firm_id, saved_case.id, null, 'task', trim(new_next_action), '', new_priority,
      null, null, new_assigned_to, null, null, null, '{}'::jsonb, null, false
    );
    perform public.crm_set_next_action(first_task.id, first_task.version, true);
  end if;
  return saved_case;
end;
$$;

notify pgrst, 'reload schema';