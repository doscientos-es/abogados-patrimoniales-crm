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

  if position('next_status in (''preparation'', ''cancelled'', ''not_held'') then null' in workflow_definition) = 0 then
    raise exception 'Unscheduled special meetings must not retain a calendar due date';
  end if;
end;
$$;