-- Run with a database-administrator connection after all migrations.
do $$
declare
  function_body text := pg_get_functiondef(
    'public.crm_put_task_on_hold(uuid,integer,text,timestamp with time zone,text)'::regprocedure
  );
begin
  if position('waiting_started' in function_body) = 0
    or position('review_at' in function_body) = 0
    or position('reason' in function_body) = 0
    or position('detail' in function_body) = 0 then
    raise exception 'The waiting event must retain its review date, reason and detail';
  end if;
  if position('crm_assert_task_member' in function_body) = 0
    or position('crm_task_actor_can_manage' in function_body) = 0
    or position('40001' in function_body) = 0 then
    raise exception 'The waiting RPC must preserve membership, role and version checks';
  end if;
end;
$$;