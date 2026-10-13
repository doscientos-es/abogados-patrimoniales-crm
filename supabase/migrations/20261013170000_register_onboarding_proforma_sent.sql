-- Record the actual send date on an existing onboarding using membership and optimistic version checks.
create or replace function public.crm_register_onboarding_proforma_sent(
  target_onboarding_id uuid,
  target_expected_version integer,
  new_proforma_sent_on date
)
returns public.crm_onboardings
language plpgsql
security definer
set search_path = public
as $$
declare
  current_record public.crm_onboardings;
  saved public.crm_onboardings;
begin
  if auth.uid() is null then raise exception 'Forbidden'; end if;

  select * into current_record
  from public.crm_onboardings
  where id = target_onboarding_id
  for update;

  if not found or not public.crm_is_firm_member(current_record.firm_id) then
    raise exception 'Onboarding not found';
  end if;
  if new_proforma_sent_on is null or new_proforma_sent_on > current_date then
    raise exception 'A valid proforma send date is required';
  end if;
  if current_record.proforma_sent_on = new_proforma_sent_on then
    return current_record;
  end if;
  if current_record.version <> target_expected_version then
    raise exception 'Onboarding changed by another user; reload before saving' using errcode = '40001';
  end if;

  update public.crm_onboardings
  set proforma_sent_on = new_proforma_sent_on,
      phase_changed_on = case when phase = 'proforma' then new_proforma_sent_on else phase_changed_on end,
      next_action = case when phase = 'proforma' then 'Comprobar el pago' else next_action end
  where id = current_record.id
  returning * into saved;

  insert into public.crm_onboarding_events (firm_id, onboarding_id, event_type, payload, actor_id)
  values (
    saved.firm_id,
    saved.id,
    'proforma_sent_registered',
    jsonb_build_object('proforma_sent_on', new_proforma_sent_on, 'previous_date', current_record.proforma_sent_on),
    auth.uid()
  );
  return saved;
end;
$$;

revoke all on function public.crm_register_onboarding_proforma_sent(uuid, integer, date) from public, anon;
grant execute on function public.crm_register_onboarding_proforma_sent(uuid, integer, date) to authenticated;
notify pgrst, 'reload schema';