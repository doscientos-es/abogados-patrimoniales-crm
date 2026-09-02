create type public.crm_task_status as enum ('pending', 'in_progress', 'completed', 'cancelled');

create table public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete restrict,
  opportunity_id uuid not null references public.crm_opportunities(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 240),
  description text not null default '',
  status public.crm_task_status not null default 'pending',
  priority public.crm_priority not null default 'medium',
  due_on date,
  assigned_to uuid references public.crm_profiles(id) on delete set null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  version integer not null default 1 check (version > 0),
  created_by uuid references public.crm_profiles(id) on delete set null,
  updated_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_task_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete restrict,
  task_id uuid not null references public.crm_tasks(id) on delete cascade,
  event_type text not null check (char_length(trim(event_type)) between 1 and 120),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  actor_id uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index crm_tasks_opportunity_idx on public.crm_tasks (opportunity_id, status, due_on);
create index crm_task_events_task_idx on public.crm_task_events (task_id, created_at desc);

create trigger crm_tasks_audit before insert on public.crm_tasks for each row execute function public.crm_assign_contact_audit();
create trigger crm_tasks_touch before update on public.crm_tasks for each row execute function public.crm_touch_entity();
create trigger crm_task_events_audit before insert on public.crm_task_events for each row execute function public.crm_assign_event_actor();

create or replace function public.crm_log_task_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.crm_task_events (firm_id, task_id, event_type, payload)
  values (
    new.firm_id,
    new.id,
    case when tg_op = 'INSERT' then 'created' else 'updated' end,
    case
      when tg_op = 'INSERT' then jsonb_build_object('status', new.status)
      when old.status is distinct from new.status then jsonb_build_object('from', old.status, 'to', new.status)
      else jsonb_build_object('version', new.version)
    end
  );
  return new;
end;
$$;

create trigger crm_tasks_log_insert after insert on public.crm_tasks for each row execute function public.crm_log_task_change();
create trigger crm_tasks_log_update after update on public.crm_tasks for each row execute function public.crm_log_task_change();

create or replace function public.crm_transition_opportunity(
  target_opportunity_id uuid,
  target_stage public.crm_opportunity_stage,
  target_substage text,
  transition_reason text default null
)
returns public.crm_opportunities
language plpgsql
security definer
set search_path = public
as $$
declare current_opportunity public.crm_opportunities;
declare previous_stage public.crm_opportunity_stage;
declare allowed boolean;
begin
  select * into current_opportunity from public.crm_opportunities where id = target_opportunity_id for update;
  if not found then raise exception 'Opportunity not found'; end if;
  if not public.crm_is_firm_member(current_opportunity.firm_id) then raise exception 'Forbidden'; end if;
  if current_opportunity.stage = target_stage then raise exception 'The opportunity is already in this stage'; end if;
  previous_stage := current_opportunity.stage;
  allowed := case current_opportunity.stage
    when 'entry' then target_stage in ('qualification', 'lost')
    when 'qualification' then target_stage in ('entry', 'first_meeting', 'lost')
    when 'first_meeting' then target_stage in ('qualification', 'quote', 'lost')
    when 'quote' then target_stage in ('first_meeting', 'validation', 'lost')
    when 'validation' then target_stage in ('quote', 'engagement', 'lost')
    when 'engagement' then target_stage in ('validation', 'won', 'lost')
    else false
  end;
  if not allowed then raise exception 'Invalid stage transition'; end if;

  update public.crm_opportunities
  set stage = target_stage,
      substage = coalesce(nullif(trim(target_substage), ''), 'Sin revisar')
  where id = target_opportunity_id
  returning * into current_opportunity;

  insert into public.crm_opportunity_events (firm_id, opportunity_id, event_type, payload)
  values (
    current_opportunity.firm_id,
    current_opportunity.id,
    'stage_changed',
    jsonb_build_object(
      'from', previous_stage,
      'to', target_stage,
      'substage', current_opportunity.substage,
      'reason', nullif(trim(transition_reason), '')
    )
  );
  return current_opportunity;
end;
$$;

alter table public.crm_tasks enable row level security;
alter table public.crm_task_events enable row level security;
create policy crm_tasks_select on public.crm_tasks for select using (public.crm_is_firm_member(firm_id));
create policy crm_tasks_insert on public.crm_tasks for insert with check (public.crm_is_firm_member(firm_id));
create policy crm_tasks_update on public.crm_tasks for update using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
create policy crm_task_events_select on public.crm_task_events for select using (public.crm_is_firm_member(firm_id));
create policy crm_task_events_insert on public.crm_task_events for insert with check (public.crm_is_firm_member(firm_id));

drop policy crm_opportunities_update on public.crm_opportunities;
grant select, insert, update on public.crm_tasks, public.crm_task_events to authenticated;
revoke all on function public.crm_transition_opportunity(uuid, public.crm_opportunity_stage, text, text) from public, anon;
grant execute on function public.crm_transition_opportunity(uuid, public.crm_opportunity_stage, text, text) to authenticated;
