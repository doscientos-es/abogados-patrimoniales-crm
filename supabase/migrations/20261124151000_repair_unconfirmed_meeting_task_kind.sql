-- Older clients saved some special meeting requests as normal tasks. Only
-- repair open requests still in preparation; do not re-open historical tasks.
update public.crm_tasks
set kind = 'event', due_at = null, due_on = null
where kind = 'task'
  and status not in ('completed', 'cancelled')
  and meeting_details ->> 'specialType' = 'meeting'
  and meeting_details ->> 'status' = 'preparation';