alter table public.crm_tasks
  alter column opportunity_id drop not null,
  add column case_id uuid references public.crm_cases(id) on delete restrict,
  add column workstream_id uuid references public.crm_case_workstreams(id) on delete set null,
  add column kind text not null default 'task' check (kind in ('task', 'reminder', 'event', 'deadline')),
  add column due_at timestamptz,
  add column reminder_at timestamptz,
  add column deadline_class text check (deadline_class in ('judicial', 'extrajudicial')),
  add column validation_status text not null default 'not_required'
    check (validation_status in ('not_required', 'proposed', 'validated', 'rejected')),
  add column deadline_source text not null default '',
  add column validation_note text not null default '',
  add column validated_by uuid references public.crm_profiles(id) on delete set null,
  add column validated_at timestamptz,
  add column completed_at timestamptz,
  add column critical boolean not null default false;

update public.crm_tasks
set due_at = due_on::timestamp at time zone 'Europe/Madrid'
where due_on is not null and due_at is null;

alter table public.crm_tasks
  add constraint crm_tasks_context_check check (opportunity_id is not null or case_id is not null),
  add constraint crm_tasks_workstream_case_check check (workstream_id is null or case_id is not null),
  add constraint crm_tasks_deadline_check check (
    (kind <> 'deadline' and validation_status = 'not_required')
    or
    (kind = 'deadline' and due_at is not null and deadline_class is not null)
  ),
  add constraint crm_tasks_validated_deadline_check check (
    validation_status <> 'validated'
    or (validated_by is not null and validated_at is not null and nullif(trim(deadline_source), '') is not null)
  );

create index crm_tasks_case_status_due_idx on public.crm_tasks(firm_id, case_id, status, due_at)
where case_id is not null;
create index crm_tasks_alerts_idx on public.crm_tasks(firm_id, validation_status, due_at)
where status in ('pending', 'in_progress');

create or replace function public.crm_validate_task_firm()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.opportunity_id is not null and not exists (
    select 1 from public.crm_opportunities where id = new.opportunity_id and firm_id = new.firm_id
  ) then raise exception 'Task opportunity must belong to the same firm'; end if;
  if new.case_id is not null and not exists (
    select 1 from public.crm_cases where id = new.case_id and firm_id = new.firm_id
  ) then raise exception 'Task case must belong to the same firm'; end if;
  if new.workstream_id is not null and not exists (
    select 1 from public.crm_case_workstreams
    where id = new.workstream_id and case_id = new.case_id and firm_id = new.firm_id
  ) then raise exception 'Task workstream must belong to the same case and firm'; end if;
  if new.assigned_to is not null and not exists (
    select 1 from public.crm_firm_members
    where firm_id = new.firm_id and user_id = new.assigned_to and status = 'active'
  ) then raise exception 'Task assignee must be an active member of the same firm'; end if;
  return new;
end;
$$;

create or replace function public.crm_guard_deadline_validation()
returns trigger language plpgsql set search_path = public as $$
declare actor_role public.crm_member_role;
begin
  if new.kind <> 'deadline' then
    new.validation_status := 'not_required';
    new.deadline_class := null; new.deadline_source := '';
    new.validated_by := null; new.validated_at := null; new.validation_note := '';
    return new;
  end if;
  if tg_op = 'INSERT' and new.validation_status = 'validated' then
    raise exception 'A deadline must be proposed before professional validation';
  end if;
  if new.validation_status = 'validated'
    and (tg_op = 'INSERT' or old.validation_status is distinct from new.validation_status) then
    select role into actor_role from public.crm_firm_members
    where firm_id = new.firm_id and user_id = auth.uid() and status = 'active';
    if actor_role not in ('owner', 'admin', 'lawyer') then
      raise exception 'Only an owner, administrator or lawyer can validate a legal deadline';
    end if;
    new.validated_by := auth.uid(); new.validated_at := now();
  end if;
  return new;
end;
$$;

create trigger crm_tasks_deadline_validation before insert or update on public.crm_tasks
for each row execute function public.crm_guard_deadline_validation();