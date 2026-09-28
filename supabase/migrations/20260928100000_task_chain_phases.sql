-- Task chains: a task can be followed by a new phase that is born blocked and
-- becomes active when the previous phase is completed. The due date of the new
-- phase can be fixed or counted in days from the completion of the previous one
-- (stored in details.chain and resolved when the phase is unblocked).

create or replace function public.crm_add_next_task(
  target_task_id uuid,
  new_title text,
  new_description text default '',
  new_priority public.crm_priority default 'medium',
  new_assigned_to uuid default null,
  new_due_at timestamptz default null,
  new_due_days integer default null,
  new_due_time text default null,
  initial_message text default null
)
returns public.crm_tasks language plpgsql security definer set search_path = public as $$
declare
  base_task public.crm_tasks;
  tail_task_id uuid;
  tail_completed boolean;
  created_task public.crm_tasks;
begin
  select * into base_task from public.crm_tasks where id = target_task_id;
  if not found then raise exception 'Task not found'; end if;
  perform public.crm_assert_task_member(base_task);
  if not public.crm_task_actor_can_manage(base_task) then raise exception 'Forbidden'; end if;
  if new_due_days is not null and (new_due_days < 1 or new_due_days > 365) then
    raise exception 'Days after the previous phase must be between 1 and 365';
  end if;
  if new_due_time is not null and new_due_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'Invalid due time';
  end if;

  with recursive chain(id, depth, created_at) as (
    select base_task.id, 0, base_task.created_at
    union
    select successor.id, chain.depth + 1, successor.created_at
    from chain
    join public.crm_task_dependencies dependency on dependency.predecessor_task_id = chain.id
    join public.crm_tasks successor on successor.id = dependency.successor_task_id
    where successor.status <> 'cancelled' and chain.depth < 100
  )
  select id into tail_task_id from chain order by depth desc, created_at desc limit 1;
  select status = 'completed' into tail_completed from public.crm_tasks where id = tail_task_id;
  if tail_completed and new_due_days is not null then
    new_due_at := (((now() at time zone 'Europe/Madrid')::date + new_due_days)
      + coalesce(new_due_time, '18:00')::time) at time zone 'Europe/Madrid';
    new_due_days := null;
  end if;

  created_task := public.crm_create_task(
    target_firm_id => base_task.firm_id,
    target_case_id => base_task.case_id,
    target_opportunity_id => base_task.opportunity_id,
    new_kind => 'task',
    new_title => new_title,
    new_description => new_description,
    new_priority => new_priority,
    new_due_at => case when new_due_days is null then new_due_at end,
    new_reminder_at => null,
    new_assigned_to => new_assigned_to,
    initial_message => initial_message,
    new_workstream_id => base_task.workstream_id
  );

  if new_due_days is not null then
    update public.crm_tasks
    set details = details || jsonb_build_object(
      'chain', jsonb_build_object('due_days', new_due_days, 'due_time', coalesce(new_due_time, '18:00'))
    )
    where id = created_task.id
    returning * into created_task;
  end if;

  perform public.crm_create_task_dependency(tail_task_id, created_task.id);
  return created_task;
end;
$$;

alter table public.crm_notifications drop constraint if exists crm_notifications_kind_check;
alter table public.crm_notifications add constraint crm_notifications_kind_check
  check (kind in ('task_message', 'task_assignment', 'task_reminder', 'task_unblocked'));

create or replace function public.crm_log_unblocked_task_successors()
returns trigger language plpgsql security definer set search_path = public as $$
declare successor public.crm_tasks; days integer; due_time text; activated_due_at timestamptz;
begin
  if new.status = 'completed' and old.status <> 'completed' then
    for successor in
      select task.* from public.crm_task_dependencies dependency
      join public.crm_tasks task on task.id = dependency.successor_task_id
      where dependency.predecessor_task_id = new.id
        and task.status not in ('completed', 'cancelled')
        and not public.crm_task_is_blocked(task.id)
    loop
      insert into public.crm_task_events(firm_id, task_id, event_type, payload)
      values (successor.firm_id, successor.id, 'dependency_unblocked',
        jsonb_build_object('predecessor_task_id', new.id));

      days := nullif(successor.details #>> '{chain,due_days}', '')::integer;
      due_time := coalesce(successor.details #>> '{chain,due_time}', '18:00');
      if days is not null and successor.due_at is null then
        activated_due_at := (((now() at time zone 'Europe/Madrid')::date + days) + due_time::time)
          at time zone 'Europe/Madrid';
        update public.crm_tasks
        set due_at = activated_due_at,
          due_on = (activated_due_at at time zone 'Europe/Madrid')::date
        where id = successor.id;
      end if;

      if successor.assigned_to is not null and successor.assigned_to is distinct from auth.uid() then
        insert into public.crm_notifications(
          firm_id, recipient_id, actor_id, actor_name, task_id, task_title, kind, body
        )
        select successor.firm_id, successor.assigned_to, auth.uid(),
          coalesce((select display_name from public.crm_profiles where id = auth.uid()), ''),
          successor.id, successor.title, 'task_unblocked',
          left(format('Se ha activado tu tarea al completarse «%s».', new.title), 280)
        where exists (
          select 1 from public.crm_firm_members member
          where member.firm_id = successor.firm_id and member.user_id = successor.assigned_to
            and member.status = 'active'
        );
      end if;
    end loop;
  end if;
  return null;
end;
$$;

revoke all on function public.crm_add_next_task(
  uuid, text, text, public.crm_priority, uuid, timestamptz, integer, text, text
) from public, anon;
grant execute on function public.crm_add_next_task(
  uuid, text, text, public.crm_priority, uuid, timestamptz, integer, text, text
) to authenticated;

notify pgrst, 'reload schema';
