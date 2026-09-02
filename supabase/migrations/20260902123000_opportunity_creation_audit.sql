-- Creation must always leave an immutable, server-side audit event.
create or replace function public.crm_log_opportunity_created()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.crm_opportunity_events (firm_id, opportunity_id, event_type, payload)
  values (
    new.firm_id,
    new.id,
    'created',
    jsonb_build_object('reference', new.reference, 'stage', new.stage, 'substage', new.substage)
  );
  return new;
end;
$$;

create trigger crm_opportunities_log_created
  after insert on public.crm_opportunities
  for each row execute function public.crm_log_opportunity_created();