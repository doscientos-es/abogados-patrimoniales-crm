-- Use the same server-side actor assignment as opportunity audit events.
-- Anonymous/system events remain unattributed; do not invent historical actors.
create trigger crm_onboarding_events_audit
before insert on public.crm_onboarding_events
for each row execute function public.crm_assign_event_actor();