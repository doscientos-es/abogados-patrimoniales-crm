create table public.crm_case_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  case_id uuid not null references public.crm_cases(id) on delete cascade,
  entity_type text not null check (entity_type in ('case', 'workstream', 'activity', 'participant')),
  entity_id uuid not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  changed_fields text[] not null default '{}'::text[],
  actor_id uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.crm_case_events enable row level security;
create policy crm_case_events_read on public.crm_case_events for select to authenticated
using (public.crm_is_firm_member(firm_id));
grant select on public.crm_case_events to authenticated;

create index crm_case_events_case_created_idx
  on public.crm_case_events(firm_id, case_id, created_at desc);

create or replace function public.crm_log_case_entity_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row jsonb;
  previous_row jsonb;
  target_case_id uuid;
  target_firm_id uuid;
  target_entity_id uuid;
  target_type text;
  target_action text;
  fields text[] := '{}'::text[];
begin
  source_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  previous_row := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  target_firm_id := (source_row ->> 'firm_id')::uuid;
  target_entity_id := (source_row ->> 'id')::uuid;
  target_case_id := case
    when tg_table_name = 'crm_cases' then target_entity_id
    else (source_row ->> 'case_id')::uuid
  end;
  target_type := case tg_table_name
    when 'crm_cases' then 'case'
    when 'crm_case_workstreams' then 'workstream'
    when 'crm_case_activities' then 'activity'
    when 'crm_case_participants' then 'participant'
  end;
  target_action := case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(current_value.key order by current_value.key), '{}'::text[])
    into fields
    from jsonb_each(source_row) current_value
    where previous_row -> current_value.key is distinct from current_value.value
      and current_value.key not in ('version', 'updated_at', 'updated_by');
  end if;

  insert into public.crm_case_events (
    firm_id, case_id, entity_type, entity_id, action, changed_fields, actor_id
  ) values (
    target_firm_id, target_case_id, target_type, target_entity_id, target_action, fields, auth.uid()
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.crm_log_case_entity_event() from public, anon, authenticated;

create trigger crm_cases_event after insert or update on public.crm_cases
for each row execute function public.crm_log_case_entity_event();
create trigger crm_case_workstreams_event after insert or update or delete on public.crm_case_workstreams
for each row execute function public.crm_log_case_entity_event();
create trigger crm_case_activities_event after insert or update or delete on public.crm_case_activities
for each row execute function public.crm_log_case_entity_event();
create trigger crm_case_participants_event after insert or update or delete on public.crm_case_participants
for each row execute function public.crm_log_case_entity_event();
