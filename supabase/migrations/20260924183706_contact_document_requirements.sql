create table public.crm_contact_documents (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete restrict,
  contact_id uuid not null,
  document_type text not null check (document_type in ('identification', 'privacy', 'authority', 'other')),
  name text not null check (char_length(trim(name)) between 1 and 240),
  original_name text not null check (char_length(trim(original_name)) between 1 and 500),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes bigint not null check (size_bytes between 1 and 26214400),
  uploaded_by uuid not null references public.crm_profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (firm_id, contact_id) references public.crm_contacts(firm_id, id) on delete restrict
);

create index crm_contact_documents_contact_idx
  on public.crm_contact_documents (firm_id, contact_id, document_type, created_at desc);

alter table public.crm_contact_documents enable row level security;
create policy crm_contact_documents_select on public.crm_contact_documents
  for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_contact_documents_insert on public.crm_contact_documents
  for insert to authenticated with check (
    public.crm_is_firm_member(firm_id)
    and uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.crm_contacts c
      where c.id = contact_id and c.firm_id = crm_contact_documents.firm_id
    )
  );

grant select, insert on public.crm_contact_documents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contact-documents', 'contact-documents', false, 26214400,
  array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy crm_contact_documents_storage_select on storage.objects
  for select to authenticated using (
    bucket_id = 'contact-documents'
    and exists (
      select 1 from public.crm_contact_documents d
      where d.storage_path = name and public.crm_is_firm_member(d.firm_id)
    )
  );

create policy crm_contact_documents_storage_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'contact-documents'
    and array_length(storage.foldername(name), 1) = 3
    and exists (
      select 1 from public.crm_contacts c
      where c.firm_id::text = (storage.foldername(name))[1]
        and c.id::text = (storage.foldername(name))[2]
        and public.crm_is_firm_member(c.firm_id)
    )
  );

notify pgrst, 'reload schema';

create table public.crm_executions (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete restrict,
  case_id uuid not null,
  workstream_id uuid,
  modality text not null check (modality in ('judicial', 'extrajudicial')),
  execution_type text not null default '',
  status text not null,
  title text not null check (char_length(trim(title)) between 1 and 240),
  object text not null default '',
  debtor text not null default '',
  beneficiary text not null default '',
  performance text not null default '',
  claimed_amount numeric(14,2) not null default 0 check (claimed_amount >= 0),
  recovered_amount numeric(14,2) not null default 0 check (recovered_amount >= 0 and recovered_amount <= claimed_amount),
  responsible_id uuid references public.crm_profiles(id) on delete set null,
  started_on date not null default current_date,
  current_position text not null default '',
  next_action text not null default '',
  dependency text not null default 'pending',
  scope text not null default '',
  budget_status text not null default 'pending_check',
  next_review_on date,
  derived_from_id uuid references public.crm_executions(id) on delete set null,
  original_nature text not null default '',
  version integer not null default 1 check (version > 0),
  created_by uuid references public.crm_profiles(id) on delete set null,
  updated_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, id),
  foreign key (firm_id, case_id) references public.crm_cases(firm_id, id) on delete restrict,
  foreign key (firm_id, case_id, workstream_id) references public.crm_case_workstreams(firm_id, case_id, id) on delete set null (workstream_id)
);

create index crm_executions_firm_status_idx on public.crm_executions (firm_id, modality, status, next_review_on);
alter table public.crm_executions enable row level security;
create policy crm_executions_select on public.crm_executions for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_executions_insert on public.crm_executions for insert to authenticated with check (public.crm_is_firm_member(firm_id));
create policy crm_executions_update on public.crm_executions for update to authenticated using (public.crm_is_firm_member(firm_id)) with check (public.crm_is_firm_member(firm_id));
grant select, insert, update on public.crm_executions to authenticated;
create trigger crm_executions_touch before update on public.crm_executions for each row execute function public.crm_touch_entity();
create trigger crm_executions_assign_audit before insert on public.crm_executions for each row execute function public.crm_assign_contact_audit();

create table public.crm_execution_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete restrict,
  execution_id uuid not null,
  event_type text not null check (event_type in ('created', 'updated', 'derived')),
  changed_fields text[] not null default '{}',
  actor_id uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (firm_id, execution_id) references public.crm_executions(firm_id, id) on delete restrict
);
create index crm_execution_events_history_idx on public.crm_execution_events (firm_id, execution_id, created_at desc);
alter table public.crm_execution_events enable row level security;
create policy crm_execution_events_select on public.crm_execution_events for select to authenticated using (public.crm_is_firm_member(firm_id));
grant select on public.crm_execution_events to authenticated;

create or replace function public.crm_log_execution_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.crm_execution_events(firm_id, execution_id, event_type, actor_id)
    values(new.firm_id, new.id, 'created', auth.uid());
  else
    insert into public.crm_execution_events(firm_id, execution_id, event_type, changed_fields, actor_id)
    select new.firm_id, new.id,
      case when new.derived_from_id is distinct from old.derived_from_id then 'derived' else 'updated' end,
      array(select key from jsonb_each(to_jsonb(new)) n where n.value is distinct from (to_jsonb(old)->key)),
      auth.uid();
  end if;
  return new;
end;
$$;
revoke all on function public.crm_log_execution_event() from public, anon, authenticated;
create trigger crm_executions_event after insert or update on public.crm_executions for each row execute function public.crm_log_execution_event();

create or replace function public.crm_derive_execution(
  target_execution_id uuid,
  target_expected_version integer
)
returns public.crm_executions
language plpgsql security definer set search_path = public as $$
declare source_execution public.crm_executions; derived_execution public.crm_executions;
begin
  if auth.uid() is null then raise exception 'Forbidden'; end if;
  select * into source_execution from public.crm_executions
  where id = target_execution_id for update;
  if not found or not public.crm_is_firm_member(source_execution.firm_id) then raise exception 'Execution not found'; end if;
  if source_execution.version <> target_expected_version then
    raise exception 'Execution changed by another user; reload before deriving' using errcode = '40001';
  end if;
  if source_execution.modality <> 'extrajudicial' then raise exception 'Only an extrajudicial execution can be derived'; end if;
  if source_execution.status = 'Derivado a ejecución judicial' then raise exception 'Execution already derived'; end if;
  insert into public.crm_executions(
    firm_id, case_id, workstream_id, modality, execution_type, status, title, object, debtor,
    beneficiary, performance, claimed_amount, recovered_amount, responsible_id, started_on,
    current_position, next_action, dependency, scope, budget_status, next_review_on,
    derived_from_id, original_nature
  ) values (
    source_execution.firm_id, source_execution.case_id, source_execution.workstream_id,
    'judicial', source_execution.execution_type, 'Título ejecutivo y firmeza', source_execution.title,
    source_execution.object, source_execution.debtor, source_execution.beneficiary,
    source_execution.performance, source_execution.claimed_amount, source_execution.recovered_amount,
    source_execution.responsible_id, current_date, 'Ejecución judicial derivada',
    'Preparar la demanda ejecutiva', source_execution.dependency, source_execution.scope,
    source_execution.budget_status, source_execution.next_review_on, source_execution.id,
    source_execution.original_nature
  ) returning * into derived_execution;
  update public.crm_executions set status = 'Derivado a ejecución judicial' where id = source_execution.id;
  return derived_execution;
end;
$$;
revoke all on function public.crm_derive_execution(uuid, integer) from public, anon;
grant execute on function public.crm_derive_execution(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
