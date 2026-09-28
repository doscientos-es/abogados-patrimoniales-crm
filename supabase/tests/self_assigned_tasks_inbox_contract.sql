-- Run with a database-administrator connection after all migrations.
do $$
declare
  trigger_definition text;
  function_definition text;
begin
  select pg_get_triggerdef(t.oid) into trigger_definition
  from pg_trigger t
  where t.tgrelid = 'public.crm_tasks'::regclass
    and t.tgname = 'crm_tasks_self_assigned_inbox'
    and not t.tgisinternal;

  function_definition := pg_get_functiondef(
    'public.crm_add_self_assigned_task_to_inbox()'::regprocedure
  );

  if trigger_definition is null
    or position('AFTER INSERT' in trigger_definition) = 0
    or position('FOR EACH ROW' in trigger_definition) = 0 then
    raise exception 'New tasks must enter their creator inbox when self-assigned';
  end if;

  if position('new.created_by = new.assigned_to' in function_definition) = 0
    or position('public.crm_task_inbox_items' in function_definition) = 0 then
    raise exception 'Only self-assigned tasks may be captured automatically';
  end if;
end;
$$;