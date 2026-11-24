-- Only the worker holding the current lease can read the minimal meeting
-- fields sent to Google; notes and other case details are deliberately omitted.
create function public.crm_google_calendar_job_details(
  job_id uuid, expected_lease uuid, expected_revision integer
)
returns table (
  task_id uuid, title text, opportunity_id uuid, case_id uuid,
  assigned_name text, staff_names text[]
)
language sql security definer set search_path = ''
as $$
  select task.id, task.title, task.opportunity_id, task.case_id,
    (select profile.display_name
      from public.crm_firm_members member
      join public.crm_profiles profile on profile.id = member.user_id
      where member.firm_id = job.firm_id and member.user_id = task.assigned_to
      limit 1),
    array(select distinct btrim(profile.display_name)
      from public.crm_firm_members member
      join public.crm_profiles profile on profile.id = member.user_id
      where member.firm_id = job.firm_id and member.status = 'active'
        and member.user_id::text = any(job.staff_ids)
        and nullif(btrim(profile.display_name), '') is not null
      order by btrim(profile.display_name))
  from public.crm_google_calendar_jobs job
  join public.crm_tasks task on task.id = job.task_id and task.firm_id = job.firm_id
  where job.id = job_id and job.active and job.lease_id = expected_lease
    and job.revision = expected_revision and job.lease_until > now();
$$;

revoke all on function public.crm_google_calendar_job_details(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.crm_google_calendar_job_details(uuid, uuid, integer) to service_role;

create function public.crm_requeue_google_calendar_meeting_metadata()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.crm_google_calendar_jobs
  set revision = revision + 1, attempts = 0, next_attempt_at = now(), last_error = null
  where firm_id = new.firm_id and task_id = new.id and active;
  return new;
end;
$$;

revoke all on function public.crm_requeue_google_calendar_meeting_metadata() from public, anon, authenticated;

create trigger crm_requeue_google_calendar_meeting_metadata
after update of title, opportunity_id, case_id, assigned_to on public.crm_tasks
for each row when (
  (old.title, old.opportunity_id, old.case_id, old.assigned_to)
  is distinct from (new.title, new.opportunity_id, new.case_id, new.assigned_to)
)
execute function public.crm_requeue_google_calendar_meeting_metadata();

create function public.crm_requeue_google_calendar_profile_name()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.crm_google_calendar_jobs job
  set revision = job.revision + 1, attempts = 0, next_attempt_at = now(), last_error = null
  where job.active and job.ends_at >= now()
    and exists (select 1 from public.crm_firm_members member
      where member.firm_id = job.firm_id and member.user_id = new.id)
    and (new.id::text = any(job.staff_ids) or exists (
      select 1 from public.crm_tasks task
      where task.id = job.task_id and task.firm_id = job.firm_id and task.assigned_to = new.id
    ));
  return new;
end;
$$;

revoke all on function public.crm_requeue_google_calendar_profile_name() from public, anon, authenticated;

create trigger crm_requeue_google_calendar_profile_name
after update of display_name on public.crm_profiles
for each row when (old.display_name is distinct from new.display_name)
execute function public.crm_requeue_google_calendar_profile_name();