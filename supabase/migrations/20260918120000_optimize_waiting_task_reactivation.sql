-- Preserve the existing "review on this Madrid calendar day" semantics while
-- making the waiting-task scan indexable.

create index if not exists crm_tasks_waiting_until_due_idx
  on public.crm_tasks (waiting_until)
  where status = 'waiting';

create or replace function public.crm_reactivate_waiting_tasks()
returns integer language plpgsql security definer set search_path = public as $$
declare
  task_record public.crm_tasks;
  reactivated_count integer := 0;
  next_madrid_day_start timestamptz :=
    (((now() at time zone 'Europe/Madrid')::date + 1)::timestamp at time zone 'Europe/Madrid');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  for task_record in
    select * from public.crm_tasks
    where status = 'waiting'
      and waiting_until < next_madrid_day_start
      and public.crm_is_firm_member(firm_id)
    for update
  loop
    update public.crm_tasks set status = 'pending' where id = task_record.id;
    insert into public.crm_task_events(firm_id, task_id, event_type, payload)
    values (task_record.firm_id, task_record.id, 'waiting_review_due', '{}'::jsonb);
    reactivated_count := reactivated_count + 1;
  end loop;
  return reactivated_count;
end;
$$;

notify pgrst, 'reload schema';