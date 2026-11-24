-- Run with a database-administrator connection after all migrations.
do $$
declare
  workflow_definition text;
begin
  select pg_get_functiondef(
    'public.crm_update_special_meeting(uuid, integer, jsonb)'::regprocedure
  ) into workflow_definition;

  if workflow_definition is null
    or position('Invalid special meeting status transition' in workflow_definition) = 0 then
    raise exception 'Special meeting workflow must reject invalid status transitions';
  end if;

  if position('A reason is required to cancel or mark a meeting as not held' in workflow_definition) = 0 then
    raise exception 'Special meeting cancellation and no-show reasons must be enforced';
  end if;

  if position('A rescheduling reason is required' in workflow_definition) = 0 then
    raise exception 'Special meeting rescheduling history and reasons must be enforced';
  end if;

  if position('due_at = case when next_status in (''scheduled'', ''in_progress'', ''finished'')' in workflow_definition) = 0 then
    raise exception 'Unscheduled special meetings must not retain a calendar due date';
  end if;
  if position('''confirmedAt'', now()' in workflow_definition) = 0
    or position('Consulta la fecha y hora en tu agenda.' in workflow_definition) = 0 then
    raise exception 'Confirming a meeting must record the confirmation and notify its hosts';
  end if;
  if position('''followUpAssigneeId'', follow_up_id, ''followUpTaskId'', follow_up.id' in workflow_definition) = 0 then
    raise exception 'The administrative follow-up must be linked to the finished appointment';
  end if;
end;
$$;
