-- Nomenclatura documental asistida por LEXIA. Los nombres originales y los archivos no se alteran.
create table if not exists public.crm_document_types (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  suggestions text[] not null default '{}',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, id)
);
create unique index if not exists crm_document_types_firm_name_key
  on public.crm_document_types (firm_id, lower(btrim(name)));
grant select, insert, update on public.crm_document_types to authenticated;
alter table public.crm_document_types enable row level security;
create policy crm_document_types_read on public.crm_document_types
  for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_document_types_insert on public.crm_document_types
  for insert to authenticated with check (exists (
    select 1 from public.crm_firm_members m where m.firm_id = crm_document_types.firm_id
      and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner', 'admin')
  ));
create policy crm_document_types_update on public.crm_document_types
  for update to authenticated
  using (exists (
    select 1 from public.crm_firm_members m where m.firm_id = crm_document_types.firm_id
      and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner', 'admin')
  ))
  with check (exists (
    select 1 from public.crm_firm_members m where m.firm_id = crm_document_types.firm_id
      and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner', 'admin')
  ));

create or replace function public.crm_seed_document_types(target_firm uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.crm_document_types (firm_id, name, sort_order)
  select target_firm, item.name, item.ordinality::integer * 10
  from unnest(array[
    'DEMANDA','CONTESTACIÓN','ESCRITO','RECURSO','SENTENCIA','AUTO','DECRETO','PROVIDENCIA',
    'DILIGENCIA','REQUERIMIENTO','BUROFAX','CONTRATO','ESCRITURA','TESTAMENTO','PODER',
    'CERTIFICADO','NOTA SIMPLE','INFORME PERICIAL','FACTURA','JUSTIFICANTE','CORRESPONDENCIA',
    'IDENTIFICACIÓN','HOJA DE ENCARGO','PRESUPUESTO','ACTA'
  ]) with ordinality as item(name, ordinality)
  on conflict do nothing;
$$;
select public.crm_seed_document_types(id) from public.crm_firms;

create or replace function public.crm_seed_document_types_on_firm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.crm_seed_document_types(new.id);
  return new;
end;
$$;
create trigger crm_firms_seed_document_types after insert on public.crm_firms
  for each row execute function public.crm_seed_document_types_on_firm();
revoke all on function public.crm_seed_document_types(uuid) from public, anon, authenticated;
revoke all on function public.crm_seed_document_types_on_firm() from public, anon, authenticated;

create table if not exists public.crm_document_naming (
  logical_document_id uuid primary key,
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  case_id uuid not null,
  type_id uuid,
  description text not null default '' check (length(description) <= 120),
  display_name text not null check (length(btrim(display_name)) between 1 and 200),
  original_name text not null,
  document_date date,
  origin_stage text,
  closed_pdf boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  ai_suggestion jsonb,
  confirmed_by uuid not null default auth.uid(),
  confirmed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_document_naming_type_scope_fkey
    foreign key (firm_id, type_id) references public.crm_document_types(firm_id, id)
    on delete restrict
);
create index if not exists crm_document_naming_case on public.crm_document_naming (case_id);
grant select, insert, update on public.crm_document_naming to authenticated;
alter table public.crm_document_naming enable row level security;
create policy crm_document_naming_read on public.crm_document_naming
  for select to authenticated using (exists (
    select 1 from public.crm_case_documents d
    where d.logical_document_id = crm_document_naming.logical_document_id
      and d.firm_id = crm_document_naming.firm_id
  ));
create policy crm_document_naming_insert on public.crm_document_naming
  for insert to authenticated with check (exists (
    select 1 from public.crm_case_documents d
    where d.logical_document_id = crm_document_naming.logical_document_id
      and d.firm_id = crm_document_naming.firm_id and d.case_id = crm_document_naming.case_id
  ));
create policy crm_document_naming_update on public.crm_document_naming
  for update to authenticated
  using (exists (
    select 1 from public.crm_case_documents d
    where d.logical_document_id = crm_document_naming.logical_document_id
      and d.firm_id = crm_document_naming.firm_id
  ))
  with check (exists (
    select 1 from public.crm_case_documents d
    where d.logical_document_id = crm_document_naming.logical_document_id
      and d.firm_id = crm_document_naming.firm_id and d.case_id = crm_document_naming.case_id
  ));

create or replace function public.crm_guard_document_naming()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.firm_id <> old.firm_id or new.original_name <> old.original_name then
      raise exception 'No se puede cambiar el despacho ni el nombre original.' using errcode = '23514';
    end if;
    new.origin_stage := old.origin_stage;
  end if;
  new.confirmed_by := auth.uid();
  new.confirmed_at := now();
  new.updated_at := now();
  return new;
end;
$$;
create trigger crm_document_naming_guard before insert or update on public.crm_document_naming
  for each row execute function public.crm_guard_document_naming();

create table if not exists public.crm_document_naming_rules (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  rule text not null check (length(btrim(rule)) between 3 and 300),
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
grant select, insert, update on public.crm_document_naming_rules to authenticated;
alter table public.crm_document_naming_rules enable row level security;
create policy crm_document_naming_rules_read on public.crm_document_naming_rules
  for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_document_naming_rules_manage on public.crm_document_naming_rules
  for all to authenticated
  using (exists (
    select 1 from public.crm_firm_members m where m.firm_id = crm_document_naming_rules.firm_id
      and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner', 'admin')
  ))
  with check (exists (
    select 1 from public.crm_firm_members m where m.firm_id = crm_document_naming_rules.firm_id
      and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner', 'admin')
  ));