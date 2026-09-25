-- Run with a database-administrator connection after all migrations.
do $$
declare
  case_index text;
  workstream_index text;
  workflow_definition text;
begin
  select indexdef into case_index
  from pg_indexes
  where schemaname = 'public'
    and indexname = 'crm_tasks_one_open_next_action_per_case_idx';
  select indexdef into workstream_index
  from pg_indexes
  where schemaname = 'public'
    and indexname = 'crm_tasks_one_open_next_action_per_workstream_idx';
  select pg_get_functiondef(
    'public.crm_set_next_action(uuid,integer,boolean)'::regprocedure
  ) into workflow_definition;

  if case_index is null or position('WORKSTREAM_ID IS NULL' in upper(case_index)) = 0 then
    raise exception 'Case-level next actions must not conflict with line-level actions';
  end if;
  if workstream_index is null or position('WORKSTREAM_ID IS NOT NULL' in upper(workstream_index)) = 0 then
    raise exception 'Each workstream must have its own open next action';
  end if;
  if workflow_definition is null
    or position('current_task.workstream_id is not null' in workflow_definition) = 0 then
    raise exception 'Changing a line next action must be scoped to that workstream';
  end if;
end;
$$;