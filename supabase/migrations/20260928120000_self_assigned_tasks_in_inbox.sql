-- Self-assigned tasks are personal inbox entries, no matter which workflow creates them.
create function public.crm_add_self_assigned_task_to_inbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null
    and new.created_by = new.assigned_to
    and exists (
      select 1 from public.crm_firm_members member
      where member.firm_id = new.firm_id
        and member.user_id = new.created_by
        and member.status = 'active'
    ) then
    insert into public.crm_task_inbox_items (firm_id, user_id, task_id)
    values (new.firm_id, new.created_by, new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.crm_add_self_assigned_task_to_inbox() from public, anon, authenticated;

create trigger crm_tasks_self_assigned_inbox
after insert on public.crm_tasks
for each row execute function public.crm_add_self_assigned_task_to_inbox();

-- Include existing active self-assigned tasks without duplicating manually captured entries.
insert into public.crm_task_inbox_items (firm_id, user_id, task_id)
select task.firm_id, task.created_by, task.id
from public.crm_tasks task
where task.created_by is not null
  and task.created_by = task.assigned_to
  and task.status in ('pending', 'in_progress', 'waiting')
  and exists (
    select 1 from public.crm_firm_members member
    where member.firm_id = task.firm_id
      and member.user_id = task.created_by
      and member.status = 'active'
  )
  and not exists (
    select 1 from public.crm_task_inbox_items item
    where item.task_id = task.id and item.user_id = task.created_by
  );