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

rollback;