-- Save the sent proforma and its linked onboarding date in the same transaction.
create function public.crm_save_sent_proforma(
  target_opportunity_id uuid, target_opportunity_version integer,
  target_onboarding_id uuid, target_onboarding_version integer, new_proforma jsonb
)
returns public.crm_opportunities language plpgsql security definer set search_path = public as $$
declare
  opportunity public.crm_opportunities;
  onboarding public.crm_onboardings;
  sent_on date;
begin
  select * into opportunity from public.crm_opportunities where id = target_opportunity_id for update;
  if not found or not public.crm_is_firm_member(opportunity.firm_id) then
    raise exception 'Lead not found';
  end if;
  select * into onboarding from public.crm_onboardings where id = target_onboarding_id for update;
  if not found or onboarding.firm_id <> opportunity.firm_id
    or onboarding.opportunity_id is distinct from opportunity.id then
    raise exception 'Onboarding not found';
  end if;
  if jsonb_typeof(new_proforma) is distinct from 'object'
    or new_proforma ->> 'estado' is distinct from 'enviada'
    or coalesce(new_proforma ->> 'fechaEnvio', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'A sent proforma with a valid date is required';
  end if;
  sent_on := (new_proforma ->> 'fechaEnvio')::date;
  perform public.crm_register_onboarding_proforma_sent(onboarding.id, target_onboarding_version, sent_on);
  select * into opportunity from public.crm_save_opportunity_details(
    opportunity.id, target_opportunity_version,
    jsonb_set(opportunity.details, '{proforma}', new_proforma, true), null, null, null
  );
  return opportunity;
end;
$$;
revoke all on function public.crm_save_sent_proforma(uuid, integer, uuid, integer, jsonb) from public, anon;
grant execute on function public.crm_save_sent_proforma(uuid, integer, uuid, integer, jsonb) to authenticated;
notify pgrst, 'reload schema';