-- Audit ledgers are append-only. Browser sessions may read them, but only
-- server-side triggers and SECURITY DEFINER workflows may create new entries.
drop policy if exists crm_opportunity_events_insert on public.crm_opportunity_events;
drop policy if exists crm_task_events_insert on public.crm_task_events;
drop policy if exists crm_note_events_create on public.crm_note_events;

revoke insert, update, delete on public.crm_opportunity_events from authenticated;
revoke insert, update, delete on public.crm_task_events from authenticated;
revoke insert, update, delete on public.crm_note_events from authenticated;

grant select on public.crm_opportunity_events to authenticated;
grant select on public.crm_task_events to authenticated;
grant select on public.crm_note_events to authenticated;

-- These triggers must retain the ability to write their ledgers after the
-- direct client grants are removed.
alter function public.crm_log_opportunity_created() security definer;
alter function public.crm_log_task_change() security definer;
alter function public.crm_assign_event_actor() security definer;
alter function public.crm_assign_note_event_actor() security definer;

revoke all on function public.crm_log_opportunity_created() from public, anon, authenticated;
revoke all on function public.crm_log_task_change() from public, anon, authenticated;
revoke all on function public.crm_assign_event_actor() from public, anon, authenticated;
revoke all on function public.crm_assign_note_event_actor() from public, anon, authenticated;

notify pgrst, 'reload schema';