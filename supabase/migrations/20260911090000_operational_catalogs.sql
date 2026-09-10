create table public.crm_task_labels (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  color text not null default 'gray' check (color in ('gray','blue','amber','rose','green','purple','teal')),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index crm_task_labels_active_name_idx on public.crm_task_labels (firm_id, lower(name)) where not archived;

create table public.crm_task_label_assignments (
  label_id uuid not null references public.crm_task_labels(id) on delete cascade,
  task_id uuid not null references public.crm_tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (label_id, task_id)
);

create table public.crm_task_title_templates (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 240),
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index crm_task_title_templates_active_title_idx on public.crm_task_title_templates (firm_id, lower(title)) where not archived;

create table public.crm_practice_areas (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  parent_id uuid references public.crm_practice_areas(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);
create unique index crm_practice_areas_active_name_idx on public.crm_practice_areas (firm_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name)) where not archived;

create or replace function public.crm_catalog_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger crm_task_labels_updated_at
before update on public.crm_task_labels
for each row execute function public.crm_catalog_set_updated_at();
create trigger crm_task_title_templates_updated_at
before update on public.crm_task_title_templates
for each row execute function public.crm_catalog_set_updated_at();
create trigger crm_practice_areas_updated_at
before update on public.crm_practice_areas
for each row execute function public.crm_catalog_set_updated_at();

alter table public.crm_task_labels enable row level security;
alter table public.crm_task_label_assignments enable row level security;
alter table public.crm_task_title_templates enable row level security;
alter table public.crm_practice_areas enable row level security;

create policy "crm task labels members read" on public.crm_task_labels for select to authenticated using (exists (select 1 from public.crm_firm_members m where m.firm_id = crm_task_labels.firm_id and m.user_id = auth.uid() and m.status = 'active'));
create policy "crm task labels admins manage" on public.crm_task_labels for all to authenticated using (exists (select 1 from public.crm_firm_members m where m.firm_id = crm_task_labels.firm_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin','lawyer'))) with check (exists (select 1 from public.crm_firm_members m where m.firm_id = crm_task_labels.firm_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin','lawyer')));
create policy "crm label assignments members read" on public.crm_task_label_assignments for select to authenticated using (exists (select 1 from public.crm_task_labels l join public.crm_firm_members m on m.firm_id = l.firm_id where l.id = label_id and m.user_id = auth.uid() and m.status = 'active'));
create policy "crm label assignments members manage" on public.crm_task_label_assignments for all to authenticated using (exists (select 1 from public.crm_task_labels l join public.crm_firm_members m on m.firm_id = l.firm_id where l.id = label_id and m.user_id = auth.uid() and m.status = 'active')) with check (exists (select 1 from public.crm_task_labels l join public.crm_firm_members m on m.firm_id = l.firm_id where l.id = label_id and m.user_id = auth.uid() and m.status = 'active'));
create policy "crm title templates members read" on public.crm_task_title_templates for select to authenticated using (exists (select 1 from public.crm_firm_members m where m.firm_id = crm_task_title_templates.firm_id and m.user_id = auth.uid() and m.status = 'active'));
create policy "crm title templates admins manage" on public.crm_task_title_templates for all to authenticated using (exists (select 1 from public.crm_firm_members m where m.firm_id = crm_task_title_templates.firm_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin','lawyer'))) with check (exists (select 1 from public.crm_firm_members m where m.firm_id = crm_task_title_templates.firm_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin','lawyer')));
create policy "crm practice areas members read" on public.crm_practice_areas for select to authenticated using (exists (select 1 from public.crm_firm_members m where m.firm_id = crm_practice_areas.firm_id and m.user_id = auth.uid() and m.status = 'active'));
create policy "crm practice areas admins manage" on public.crm_practice_areas for all to authenticated using (exists (select 1 from public.crm_firm_members m where m.firm_id = crm_practice_areas.firm_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin','lawyer'))) with check (exists (select 1 from public.crm_firm_members m where m.firm_id = crm_practice_areas.firm_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin','lawyer')));

create or replace function public.crm_merge_task_labels(source_label_id uuid, target_label_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare source_firm uuid;
begin
  select firm_id into source_firm from public.crm_task_labels where id = source_label_id and not archived;
  if source_firm is null or source_label_id = target_label_id then raise exception 'Invalid source label'; end if;
  if not exists (select 1 from public.crm_task_labels where id = target_label_id and firm_id = source_firm and not archived) then raise exception 'Invalid target label'; end if;
  if not exists (select 1 from public.crm_firm_members where firm_id = source_firm and user_id = auth.uid() and status = 'active' and role in ('owner','admin','lawyer')) then raise exception 'Forbidden'; end if;
  insert into public.crm_task_label_assignments (label_id, task_id)
  select target_label_id, task_id from public.crm_task_label_assignments where label_id = source_label_id on conflict do nothing;
  delete from public.crm_task_label_assignments where label_id = source_label_id;
  update public.crm_task_labels set archived = true, updated_at = now() where id = source_label_id;
end;
$$;
revoke all on function public.crm_merge_task_labels(uuid, uuid) from public, anon;
grant execute on function public.crm_merge_task_labels(uuid, uuid) to authenticated;
