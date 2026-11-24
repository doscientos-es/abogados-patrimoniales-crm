-- pg_net sends the request only after commit. A failure to enqueue a request
-- must never prevent saving the meeting; the scheduled worker retries it.
create function public.crm_dispatch_google_calendar_job_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.next_attempt_at is not null and exists (
    select 1 from cron.job
    where jobname = 'crm-google-calendar-sync' and username = current_user and active
  ) then
    perform public.crm_dispatch_google_calendar_sync();
  end if;
  return new;
exception when others then
  raise warning 'Google Calendar dispatch failed; the appointment remains queued for retry';
  return new;
end;
$$;

revoke all on function public.crm_dispatch_google_calendar_job_change() from public, anon, authenticated;

create trigger crm_dispatch_google_calendar_job_insert
after insert on public.crm_google_calendar_jobs
for each row execute function public.crm_dispatch_google_calendar_job_change();

create trigger crm_dispatch_google_calendar_job_update
after update of revision on public.crm_google_calendar_jobs
for each row when (old.revision is distinct from new.revision)
execute function public.crm_dispatch_google_calendar_job_change();