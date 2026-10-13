-- Run with a database-administrator connection after all migrations.
do $$
declare
  insert_trigger text;
  update_trigger text;
  function_body text;
begin
  select pg_get_triggerdef(trg.oid) into insert_trigger
  from pg_trigger trg
  where trg.tgrelid = 'public.crm_tasks'::regclass
    and trg.tgname = 'crm_tasks_notify_assignee_insert';
  select pg_get_triggerdef(trg.oid) into update_trigger
  from pg_trigger trg
  where trg.tgrelid = 'public.crm_tasks'::regclass
    and trg.tgname = 'crm_tasks_notify_assignee_update';
  function_body := pg_get_functiondef('public.crm_notify_task_assignee()'::regprocedure);

  if insert_trigger is null or position('DEFERRABLE INITIALLY DEFERRED' in insert_trigger) = 0 then
    raise exception 'Task creation notification must run after any initial manual message';
  end if;
  if update_trigger is null or position('UPDATE OF assigned_to' in update_trigger) = 0
    or position('old.assigned_to IS DISTINCT FROM new.assigned_to' in update_trigger) = 0 then
    raise exception 'Only a real reassignment may notify';
  end if;
  if position('is not distinct from actor' in function_body) = 0 then
    raise exception 'Self-assignment must not notify';
  end if;
  if position('actor is null then return null' in function_body) = 0 then
    raise exception 'System-generated tasks without an actor must not produce generic assignment notifications';
  end if;
  if position('initial_assignment' in function_body) = 0 then
    raise exception 'A manual initial message must not be duplicated';
  end if;
  if position('task_assignment' in function_body) = 0
    or position('crm_notifications' in function_body) = 0 then
    raise exception 'Assignment must use the existing notifications table';
  end if;
end;
$$;