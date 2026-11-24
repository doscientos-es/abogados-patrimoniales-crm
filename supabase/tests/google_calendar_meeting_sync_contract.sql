-- Run after all migrations with a database-administrator connection. No HTTP requests are made.
begin;

do $$
declare
  meeting public.crm_tasks;
  first_claim record;
  next_claim record;
  starts timestamptz := now() + interval '2 days';
  host_id uuid := gen_random_uuid();
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.crm_tasks'::regclass
    and tgname = 'crm_enqueue_google_calendar_meeting' and tgenabled = 'O') then
    raise exception 'The appointment queue must be connected to CRM task changes';
  end if;
  if has_table_privilege('authenticated', 'public.crm_google_calendar_jobs', 'SELECT')
    or has_function_privilege('authenticated', 'public.crm_claim_google_calendar_jobs(uuid, text)', 'EXECUTE') then
    raise exception 'Authenticated CRM users must not read the queue or claim invitations';
  end if;

  meeting.id := gen_random_uuid();
  meeting.firm_id := gen_random_uuid();
  meeting.kind := 'event';
  meeting.status := 'pending';
  meeting.assigned_to := gen_random_uuid();
  meeting.meeting_details := jsonb_build_object(
    'specialType', 'meeting', 'status', 'preparation', 'startsAt', starts,
    'endsAt', starts + interval '1 hour', 'attendeeUserIds', jsonb_build_array(host_id, host_id)
  );

  perform public.crm_capture_google_calendar_meeting(meeting, false);
  if exists (select 1 from public.crm_google_calendar_jobs where firm_id = meeting.firm_id) then
    raise exception 'A meeting in preparation must not be sent to Google';
  end if;

  meeting.meeting_details := meeting.meeting_details || jsonb_build_object('status', 'scheduled');
  perform public.crm_capture_google_calendar_meeting(meeting, false);
  if (select staff_ids from public.crm_google_calendar_jobs where firm_id = meeting.firm_id)
    is distinct from array[host_id::text] then
    raise exception 'The queue must deduplicate the hosts and exclude the scheduling assignee';
  end if;
  select * into strict first_claim from public.crm_claim_google_calendar_jobs(meeting.firm_id, 'example.com');
  if not first_claim.active or first_claim.revision <> 1
    or first_claim.emails is distinct from '{}'::text[] or exists (
      select 1 from public.crm_claim_google_calendar_jobs(meeting.firm_id, 'example.com')
    ) then
    raise exception 'Only active staff accounts can be invited, and a leased item cannot be claimed twice';
  end if;

  meeting.meeting_details := meeting.meeting_details || jsonb_build_object('endsAt', starts + interval '2 hours');
  perform public.crm_capture_google_calendar_meeting(meeting, false);
  perform public.crm_finish_google_calendar_job(first_claim.id, first_claim.lease_id, first_claim.revision, null);
  select * into strict next_claim from public.crm_claim_google_calendar_jobs(meeting.firm_id, 'example.com');
  if next_claim.id <> first_claim.id or next_claim.revision <> 2
    or next_claim.ends_at <> starts + interval '2 hours' then
    raise exception 'A worker finishing an older revision must not lose a reschedule or change the event ID';
  end if;
  perform public.crm_finish_google_calendar_job(next_claim.id, next_claim.lease_id, next_claim.revision, null);
  perform public.crm_capture_google_calendar_meeting(meeting, false);
  if exists (select 1 from public.crm_claim_google_calendar_jobs(meeting.firm_id, 'example.com')) then
    raise exception 'Saving an unchanged appointment must not enqueue another invitation';
  end if;

  meeting.meeting_details := meeting.meeting_details || jsonb_build_object('status', 'preparation');
  perform public.crm_capture_google_calendar_meeting(meeting, false);
  select * into strict next_claim from public.crm_claim_google_calendar_jobs(meeting.firm_id, 'example.com');
  if next_claim.id <> first_claim.id or next_claim.active then
    raise exception 'Withdrawing a booking must cancel its existing Google event';
  end if;
  perform public.crm_finish_google_calendar_job(next_claim.id, next_claim.lease_id, next_claim.revision, null);

  meeting.meeting_details := meeting.meeting_details || jsonb_build_object('status', 'scheduled');
  perform public.crm_capture_google_calendar_meeting(meeting, false);
  select * into strict next_claim from public.crm_claim_google_calendar_jobs(meeting.firm_id, 'example.com');
  if next_claim.id = first_claim.id or not next_claim.active then
    raise exception 'Reconfirming a withdrawn booking requires a new Google event ID';
  end if;
end;
$$;

-- This test temporarily changes Vault and Cron and must only run on an
-- isolated test database. The transaction rolls every change back.
do $$
declare
  scheduled_job_id bigint;
  test_secret text := repeat('s', 32);
  valid_token text := repeat('a', 64);
  expired_token text := repeat('b', 64);
  meeting public.crm_tasks;
  request_count bigint;
  claimed record;
begin
  if has_table_privilege('authenticated', 'public.crm_google_calendar_invocations', 'SELECT')
    or has_function_privilege('authenticated', 'public.crm_consume_google_calendar_invocation(text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.crm_dispatch_google_calendar_sync()', 'EXECUTE') then
    raise exception 'CRM users must not issue or consume worker credentials';
  end if;
  select jobid into strict scheduled_job_id from cron.job
  where jobname = 'crm-google-calendar-sync' and username = current_user;
  perform cron.alter_job(scheduled_job_id, active := false);
  perform public.crm_enable_google_calendar_sync(
    'https://example.supabase.co/functions/v1/google-calendar-sync', test_secret);
  if not exists (select 1 from cron.job where jobid = scheduled_job_id and active) then
    raise exception 'Activation must re-enable the scheduled job';
  end if;
  if not (select enabled from public.crm_google_calendar_sync_status(gen_random_uuid())) then
    raise exception 'Activation must report that synchronization is enabled';
  end if;

  meeting.id := gen_random_uuid();
  meeting.firm_id := gen_random_uuid();
  meeting.kind := 'event';
  meeting.status := 'pending';
  meeting.meeting_details := jsonb_build_object(
    'specialType', 'meeting', 'status', 'scheduled', 'startsAt', now() + interval '2 days',
    'endsAt', now() + interval '2 days 1 hour'
  );
  select count(*) into request_count from net.http_request_queue;
  perform public.crm_capture_google_calendar_meeting(meeting, false);
  if (select count(*) from net.http_request_queue) <> request_count + 1 then
    raise exception 'Confirming a meeting must dispatch immediately';
  end if;
  perform public.crm_capture_google_calendar_meeting(meeting, false);
  select * into strict claimed from public.crm_claim_google_calendar_jobs(meeting.firm_id, 'example.com');
  perform public.crm_finish_google_calendar_job(claimed.id, claimed.lease_id, claimed.revision, 'calendar_request');
  if (select count(*) from net.http_request_queue) <> request_count + 1 then
    raise exception 'Unchanged meetings and retry bookkeeping must not dispatch immediately';
  end if;
  meeting.meeting_details := meeting.meeting_details || jsonb_build_object('endsAt', now() + interval '2 days 2 hours');
  perform public.crm_capture_google_calendar_meeting(meeting, false);
  perform public.crm_capture_google_calendar_meeting(meeting, true);
  if (select count(*) from net.http_request_queue) <> request_count + 3 then
    raise exception 'Rescheduling and cancelling must dispatch immediately';
  end if;
  perform cron.alter_job(scheduled_job_id, active := false);
  perform public.crm_capture_google_calendar_meeting(meeting, false);
  if (select count(*) from net.http_request_queue) <> request_count + 3 then
    raise exception 'Pausing synchronization must also stop immediate dispatch';
  end if;

  insert into public.crm_google_calendar_invocations (token_hash, expires_at) values
    (extensions.hmac(valid_token, test_secret, 'sha256'), now() + interval '2 minutes'),
    (extensions.hmac(expired_token, test_secret, 'sha256'), now() - interval '1 second');
  if public.crm_consume_google_calendar_invocation(null)
    or public.crm_consume_google_calendar_invocation('invalid')
    or public.crm_consume_google_calendar_invocation(repeat('c', 64))
    or public.crm_consume_google_calendar_invocation(expired_token) then
    raise exception 'Invalid, unknown and expired credentials must be rejected';
  end if;
  if not public.crm_consume_google_calendar_invocation(valid_token) then
    raise exception 'A valid worker credential must be accepted';
  end if;
  if public.crm_consume_google_calendar_invocation(valid_token) then
    raise exception 'A valid worker credential must be consumed exactly once';
  end if;
end;
$$;

-- Simulate an unavailable dispatcher without making a network request.
-- This replacement and every other test change are rolled back below.
create or replace function public.crm_dispatch_google_calendar_sync()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  raise exception 'Simulated dispatch failure';
end;
$$;

do $$
declare
  scheduled_job_id bigint;
  job_id uuid := gen_random_uuid();
begin
  select jobid into strict scheduled_job_id from cron.job
  where jobname = 'crm-google-calendar-sync' and username = current_user;
  perform cron.alter_job(scheduled_job_id, active := true);
  insert into public.crm_google_calendar_jobs (id, firm_id, task_id, starts_at, ends_at, staff_ids)
  values (job_id, gen_random_uuid(), gen_random_uuid(), now(), now() + interval '1 hour', '{}');
  if not exists (select 1 from public.crm_google_calendar_jobs where id = job_id and next_attempt_at is not null) then
    raise exception 'Dispatch failures must not prevent the meeting from being queued';
  end if;
end;
$$;

rollback;
