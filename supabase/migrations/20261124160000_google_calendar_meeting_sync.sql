-- Keep each active booking on its own Google event ID. Reconfirming after
-- cancellation gets a fresh ID, even if Google still holds a deleted event.
create table public.crm_google_calendar_jobs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  task_id uuid not null,
  active boolean not null default true,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  staff_ids text[] not null,
  revision integer not null default 1,
  attempts integer not null default 0,
  next_attempt_at timestamptz default now(),
  lease_id uuid,
  lease_until timestamptz,
  last_error text check (last_error in ('google_auth', 'calendar_request', 'staff_email')),
  synced_at timestamptz
);

create unique index crm_google_calendar_job_active_idx
  on public.crm_google_calendar_jobs (firm_id, task_id) where active;
create index crm_google_calendar_job_ready_idx
  on public.crm_google_calendar_jobs (firm_id, next_attempt_at) where next_attempt_at is not null;

alter table public.crm_google_calendar_jobs enable row level security;
revoke all on public.crm_google_calendar_jobs from public, anon, authenticated;

create function public.crm_capture_google_calendar_meeting(meeting public.crm_tasks, deleting boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  details jsonb := meeting.meeting_details;
  starts timestamptz;
  ends timestamptz;
  staff text[];
begin
  if not deleting and meeting.kind = 'event' and meeting.status <> 'cancelled'
    and (details ->> 'specialType' = 'meeting'
      or (meeting.opportunity_id is not null and details ? 'primeraCita'))
    and (details ->> 'status' in ('scheduled', 'in_progress', 'finished')
      or (details ->> 'status' is null
        and details #>> '{primeraCita,estado}' in ('Programada', 'En curso', 'Celebrada'))) then
    begin
      starts := nullif(details ->> 'startsAt', '')::timestamptz;
      ends := nullif(details ->> 'endsAt', '')::timestamptz;
    exception when invalid_datetime_format or datetime_field_overflow then
      starts := null;
    end;
  end if;

  if not coalesce(isfinite(starts) and isfinite(ends) and starts < ends, false) then
    update public.crm_google_calendar_jobs
    set active = false, revision = revision + 1, attempts = 0, next_attempt_at = now(), last_error = null
    where firm_id = meeting.firm_id and task_id = meeting.id and active;
    return;
  end if;

  select coalesce(array_agg(distinct person.id order by person.id), '{}'::text[]) into staff
  from (
    select nullif(details ->> 'abogadoPrimeraCitaId', '') as id
    union all
    select jsonb_array_elements_text(case when jsonb_typeof(details -> 'attendeeUserIds') = 'array'
      then details -> 'attendeeUserIds' else '[]'::jsonb end)
  ) as person where nullif(person.id, '') is not null;
  -- Legacy appointments without explicit hosts use the assigned person, not the creator.
  if cardinality(staff) = 0 and meeting.assigned_to is not null then
    staff := array[meeting.assigned_to::text];
  end if;

  insert into public.crm_google_calendar_jobs as job(firm_id, task_id, starts_at, ends_at, staff_ids)
  values (meeting.firm_id, meeting.id, starts, ends, staff)
  on conflict (firm_id, task_id) where active do update
  set starts_at = excluded.starts_at, ends_at = excluded.ends_at, staff_ids = excluded.staff_ids,
      revision = job.revision + 1, attempts = 0, next_attempt_at = now(), last_error = null
  where (job.starts_at, job.ends_at, job.staff_ids)
    is distinct from (excluded.starts_at, excluded.ends_at, excluded.staff_ids);
end;
$$;

create function public.crm_enqueue_google_calendar_meeting()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.crm_capture_google_calendar_meeting(old, true);
    return old;
  end if;
  if tg_op = 'UPDATE' and old.firm_id is distinct from new.firm_id then
    perform public.crm_capture_google_calendar_meeting(old, true);
  end if;
  perform public.crm_capture_google_calendar_meeting(new, false);
  return new;
end;
$$;

create trigger crm_enqueue_google_calendar_meeting
after insert or update of firm_id, kind, status, assigned_to, meeting_details or delete on public.crm_tasks
for each row execute function public.crm_enqueue_google_calendar_meeting();

create function public.crm_claim_google_calendar_jobs(target_firm uuid, staff_domain text)
returns table (
  id uuid, active boolean, starts_at timestamptz, ends_at timestamptz,
  revision integer, lease_id uuid, emails text[], staff_count integer
)
language sql security definer set search_path = ''
as $$
  with ready as (
    select job.id
    from public.crm_google_calendar_jobs job
    where job.firm_id = target_firm and job.next_attempt_at <= now()
      and (job.lease_until is null or job.lease_until <= now())
    order by job.next_attempt_at, job.id
    limit 5 for update skip locked
  ), claimed as (
    update public.crm_google_calendar_jobs job
    set lease_id = gen_random_uuid(), lease_until = now() + interval '3 minutes'
    from ready where job.id = ready.id
    returning job.*
  )
  select job.id, job.active, job.starts_at, job.ends_at, job.revision, job.lease_id,
    array(select distinct lower(account.email)
      from public.crm_firm_members member join auth.users account on account.id = member.user_id
      where job.active and member.firm_id = job.firm_id and member.status = 'active'
        and member.user_id::text = any(job.staff_ids) and account.email_confirmed_at is not null
        and lower(split_part(account.email, '@', 2)) = lower(staff_domain)
      order by lower(account.email)), cardinality(job.staff_ids)
  from claimed job;
$$;

create function public.crm_finish_google_calendar_job(
  job_id uuid, expected_lease uuid, processed_revision integer, error_code text
)
returns void
language sql security definer set search_path = ''
as $$
  update public.crm_google_calendar_jobs job
  set lease_id = null, lease_until = null,
      attempts = case when job.revision <> processed_revision then job.attempts
        when error_code is null then 0 else job.attempts + 1 end,
      next_attempt_at = case when job.revision <> processed_revision then job.next_attempt_at
        when error_code is null then null
        else now() + make_interval(secs => least(3600, 30 * (2 ^ least(job.attempts, 7)))) end,
      last_error = case when job.revision <> processed_revision then job.last_error else error_code end,
      synced_at = case when job.revision = processed_revision and error_code is null then now() else job.synced_at end
  where job.id = job_id and job.lease_id = expected_lease;
$$;

revoke all on function public.crm_capture_google_calendar_meeting(public.crm_tasks, boolean) from public, anon, authenticated;
revoke all on function public.crm_enqueue_google_calendar_meeting() from public, anon, authenticated;
revoke all on function public.crm_claim_google_calendar_jobs(uuid, text) from public, anon, authenticated;
revoke all on function public.crm_finish_google_calendar_job(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.crm_claim_google_calendar_jobs(uuid, text) to service_role;
grant execute on function public.crm_finish_google_calendar_job(uuid, uuid, integer, text) to service_role;

-- Include already-confirmed upcoming appointments on first configuration.
do $$
begin
  perform public.crm_capture_google_calendar_meeting(task, false)
  from public.crm_tasks task where task.kind = 'event' and task.due_at >= now();
end;
$$;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Nothing is sent until both Vault entries have been configured.
select cron.schedule('crm-google-calendar-sync', '* * * * *', $cron$
  select net.http_post(
    url := conf.worker_url,
    headers := jsonb_build_object('x-crm-calendar-secret', conf.worker_secret),
    timeout_milliseconds := 90000
  )
  from (
    select max(decrypted_secret) filter (where name = 'crm_google_calendar_worker_url') as worker_url,
      max(decrypted_secret) filter (where name = 'crm_google_calendar_worker_secret') as worker_secret
    from vault.decrypted_secrets
    where name in ('crm_google_calendar_worker_url', 'crm_google_calendar_worker_secret')
  ) conf
  where conf.worker_url is not null and length(conf.worker_secret) >= 32;
$cron$);

-- Called only by the server after validating an active firm administrator.
-- Values never leave the server and are stored encrypted by Vault.
create function public.crm_enable_google_calendar_sync(worker_url text, worker_secret text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  saved_id uuid;
begin
  if worker_url !~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/google-calendar-sync$'
    or length(worker_secret) not between 32 and 256 then
    raise exception 'Invalid calendar worker configuration';
  end if;
  select id into saved_id from vault.secrets where name = 'crm_google_calendar_worker_url';
  if saved_id is null then
    perform vault.create_secret(worker_url, 'crm_google_calendar_worker_url');
  else
    perform vault.update_secret(saved_id, worker_url);
  end if;
  select id into saved_id from vault.secrets where name = 'crm_google_calendar_worker_secret';
  if saved_id is null then
    perform vault.create_secret(worker_secret, 'crm_google_calendar_worker_secret');
  else
    perform vault.update_secret(saved_id, worker_secret);
  end if;
  update cron.job set active = true where jobname = 'crm-google-calendar-sync';
  if not found then raise exception 'Calendar schedule is not installed'; end if;
end;
$$;

create function public.crm_google_calendar_sync_status(target_firm uuid)
returns table (enabled boolean, pending bigint, failed bigint)
language sql security definer set search_path = ''
as $$
  select exists (select 1 from cron.job where jobname = 'crm-google-calendar-sync' and active)
    and (select count(distinct name) = 2 from vault.secrets
      where name in ('crm_google_calendar_worker_url', 'crm_google_calendar_worker_secret')),
    count(*) filter (where next_attempt_at is not null),
    count(*) filter (where last_error is not null)
  from public.crm_google_calendar_jobs where firm_id = target_firm;
$$;

revoke all on function public.crm_enable_google_calendar_sync(text, text) from public, anon, authenticated;
revoke all on function public.crm_google_calendar_sync_status(uuid) from public, anon, authenticated;
grant execute on function public.crm_enable_google_calendar_sync(text, text) to service_role;
grant execute on function public.crm_google_calendar_sync_status(uuid) to service_role;
