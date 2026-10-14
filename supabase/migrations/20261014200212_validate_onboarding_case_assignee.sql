create or replace function public.crm_open_onboarding_case(
  target_onboarding_id uuid, target_expected_version integer, new_title text, new_area text,
  new_matter_type text, new_nature text, new_priority public.crm_priority,
  new_assigned_to uuid, new_next_action text, new_current_position text
)
returns public.crm_cases language plpgsql security definer set search_path = public as $$
declare
  current_record public.crm_onboardings;
  source_opportunity public.crm_opportunities;
  saved_case public.crm_cases;
  primary_contact_name text;
  primary_role text;
  participant jsonb;
  participant_contact_id uuid;
  participant_name text;
  participant_role text;
begin
  select * into current_record
  from public.crm_onboardings
  where id = target_onboarding_id
  for update;

  if not found or not public.crm_is_firm_member(current_record.firm_id) then
    raise exception 'Onboarding not found';
  end if;
  if current_record.version <> target_expected_version then
    raise exception 'Onboarding changed by another user; reload before opening the case'
      using errcode = '40001';
  end if;
  if current_record.phase not in ('proforma', 'payment', 'formal_start', 'completed') then
    raise exception 'Onboarding phase does not allow opening a case';
  end if;
  if current_record.case_id is not null then
    raise exception 'A case is already linked to this onboarding';
  end if;
  if nullif(trim(new_title), '') is null
    or new_nature not in ('judicial', 'extrajudicial')
    or new_priority is null then
    raise exception 'Case data is incomplete';
  end if;
  if new_assigned_to is not null and not exists (
    select 1 from public.crm_firm_members m
    where m.firm_id = current_record.firm_id
      and m.user_id = new_assigned_to
      and m.status = 'active'
  ) then
    raise exception 'Case assignee must be an active member of the same firm';
  end if;
  if current_record.payment_confirmed_on is null then
    if nullif(trim(new_current_position), '') is null
      or new_current_position not like 'Inicio sin provisión autorizado:%' then
      raise exception 'Opening without a provision requires a recorded reason';
    end if;
    if not exists (
      select 1 from public.crm_firm_members m
      where m.firm_id = current_record.firm_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role in ('owner', 'admin', 'lawyer')
    ) then
      raise exception 'Only an authorized firm member can open a case without a provision';
    end if;
  end if;

  select * into source_opportunity
  from public.crm_opportunities
  where id = current_record.opportunity_id
    and firm_id = current_record.firm_id;

  insert into public.crm_cases (
    firm_id, primary_contact_id, opportunity_id, title, area, matter_type, nature,
    priority, assigned_to, next_action, current_position, details
  ) values (
    current_record.firm_id, current_record.contact_id, current_record.opportunity_id,
    trim(new_title), trim(coalesce(new_area, '')), trim(coalesce(new_matter_type, '')),
    new_nature, new_priority, new_assigned_to, trim(coalesce(new_next_action, '')),
    trim(coalesce(new_current_position, '')),
    jsonb_build_object(
      'commercialIntake', coalesce(source_opportunity.details, '{}'::jsonb),
      'onboardingId', current_record.id
    )
  ) returning * into saved_case;

  select coalesce(c.display_name, 'Contacto principal'),
    coalesce(source_opportunity.details #>> '{rolContacto,rol}', 'Contacto principal')
  into primary_contact_name, primary_role
  from public.crm_contacts c
  where c.id = current_record.contact_id and c.firm_id = current_record.firm_id;

  insert into public.crm_case_participants (firm_id, case_id, contact_id, name, role, details)
  values (
    saved_case.firm_id, saved_case.id, current_record.contact_id,
    primary_contact_name, primary_role,
    jsonb_build_object('source', 'lead', 'sourceOpportunityId', current_record.opportunity_id)
  );

  if jsonb_typeof(source_opportunity.details -> 'otrosIntervinientes') = 'array' then
    for participant in
      select value from jsonb_array_elements(source_opportunity.details -> 'otrosIntervinientes')
    loop
      participant_contact_id := null;
      begin
        participant_contact_id := (participant ->> 'contactoId')::uuid;
      exception when invalid_text_representation then
        participant_contact_id := null;
      end;
      if participant_contact_id is not null and not exists (
        select 1 from public.crm_contacts c
        where c.id = participant_contact_id and c.firm_id = current_record.firm_id
      ) then
        participant_contact_id := null;
      end if;
      participant_name := nullif(trim(coalesce(participant ->> 'nombre', '')), '');
      participant_role := nullif(trim(coalesce(participant ->> 'rol', 'Interviniente')), '');
      if participant_name is null and participant_contact_id is not null then
        select display_name into participant_name
        from public.crm_contacts
        where id = participant_contact_id and firm_id = current_record.firm_id;
      end if;
      if participant_name is not null then
        insert into public.crm_case_participants (
          firm_id, case_id, contact_id, name, role, details
        ) values (
          saved_case.firm_id, saved_case.id, participant_contact_id, participant_name,
          coalesce(participant_role, 'Interviniente'),
          jsonb_build_object('source', 'lead', 'sourceOpportunityId', current_record.opportunity_id)
        );
      end if;
    end loop;
  end if;

  update public.crm_onboardings
  set case_id = saved_case.id, next_action = 'Expediente abierto'
  where id = current_record.id;
  insert into public.crm_onboarding_events (firm_id, onboarding_id, event_type, payload)
  values (current_record.firm_id, current_record.id, 'case_opened',
    jsonb_build_object(
      'case_id', saved_case.id,
      'participants_transferred', true,
      'opened_without_provision', current_record.payment_confirmed_on is null
    ));
  return saved_case;
end;
$$;

revoke all on function public.crm_open_onboarding_case(
  uuid, integer, text, text, text, text, public.crm_priority, uuid, text, text
) from public, anon;
grant execute on function public.crm_open_onboarding_case(
  uuid, integer, text, text, text, text, public.crm_priority, uuid, text, text
) to authenticated;
notify pgrst, 'reload schema';
