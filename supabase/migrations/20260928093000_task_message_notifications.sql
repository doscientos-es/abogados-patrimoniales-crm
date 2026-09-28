-- Personal notifications raised by task conversations. Every new comment,
-- assignment or reminder notifies the task creator, the assignee and anyone who
-- already took part in the conversation (except the author).

create table public.crm_notifications (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  recipient_id uuid not null references public.crm_profiles(id) on delete cascade,
  actor_id uuid references public.crm_profiles(id) on delete set null,
  actor_name text not null default '',
  task_id uuid references public.crm_tasks(id) on delete cascade,
  task_title text not null default '',
  message_id uuid references public.crm_task_messages(id) on delete cascade,
  kind text not null check (kind in ('task_message', 'task_assignment', 'task_reminder')),
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index crm_notifications_recipient_created_idx
  on public.crm_notifications(recipient_id, created_at desc);
create index crm_notifications_recipient_unread_idx
  on public.crm_notifications(recipient_id) where read_at is null;
create index crm_notifications_firm_id_idx on public.crm_notifications(firm_id);
create index crm_notifications_actor_id_idx on public.crm_notifications(actor_id);
create index crm_notifications_task_id_idx on public.crm_notifications(task_id);
create index crm_notifications_message_id_idx on public.crm_notifications(message_id);

alter table public.crm_notifications enable row level security;
create policy crm_notifications_own_read on public.crm_notifications for select to authenticated
  using (recipient_id = (select auth.uid()) and public.crm_is_firm_member(firm_id));
revoke all on public.crm_notifications from public, anon, authenticated;
grant select on public.crm_notifications to authenticated;

create or replace function public.crm_notify_task_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare current_task public.crm_tasks; author_name text;
begin
  select * into current_task from public.crm_tasks where id = new.task_id;
  if not found then return new; end if;
  select coalesce(profile.display_name, '') into author_name
  from public.crm_profiles profile where profile.id = new.author_id;

  insert into public.crm_notifications(
    firm_id, recipient_id, actor_id, actor_name, task_id, task_title, message_id, kind, body
  )
  select
    new.firm_id,
    recipient.user_id,
    new.author_id,
    coalesce(author_name, ''),
    new.task_id,
    current_task.title,
    new.id,
    case
      when new.message_type = 'initial_assignment' then 'task_assignment'
      when new.body like 'Recordatorio al responsable: %' then 'task_reminder'
      else 'task_message'
    end,
    left(new.body, 280)
  from (
    select current_task.created_by as user_id
    union select current_task.assigned_to
    union select message.author_id from public.crm_task_messages message
      where message.task_id = new.task_id
  ) recipient
  where recipient.user_id is not null
    and recipient.user_id is distinct from new.author_id
    and exists (
      select 1 from public.crm_firm_members member
      where member.firm_id = new.firm_id and member.user_id = recipient.user_id
        and member.status = 'active'
    );
  return new;
end;
$$;

create trigger crm_task_messages_notify after insert on public.crm_task_messages
  for each row when (new.message_type <> 'system')
  execute function public.crm_notify_task_message();

create or replace function public.crm_mark_notifications_read(target_task_id uuid default null)
returns integer language plpgsql security definer set search_path = public as $$
declare affected integer;
begin
  if auth.uid() is null then raise exception 'Forbidden'; end if;
  update public.crm_notifications
  set read_at = now()
  where recipient_id = auth.uid()
    and read_at is null
    and (target_task_id is null or task_id = target_task_id);
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.crm_notify_task_message() from public, anon, authenticated;
revoke all on function public.crm_mark_notifications_read(uuid) from public, anon;
grant execute on function public.crm_mark_notifications_read(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.crm_notifications;
  end if;
end;
$$;
