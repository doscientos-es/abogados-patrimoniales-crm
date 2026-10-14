create table public.crm_lead_roles (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index crm_lead_roles_active_name_idx
  on public.crm_lead_roles (firm_id, lower(trim(name)))
  where not archived;

create trigger crm_lead_roles_updated_at
before update on public.crm_lead_roles
for each row execute function public.crm_catalog_set_updated_at();

alter table public.crm_lead_roles enable row level security;

create policy crm_lead_roles_read on public.crm_lead_roles
  for select to authenticated using (
    exists (
      select 1 from public.crm_firm_members member
      where member.firm_id = crm_lead_roles.firm_id
        and member.user_id = (select auth.uid())
        and member.status = 'active'
    )
  );

create policy crm_lead_roles_insert on public.crm_lead_roles
  for insert to authenticated with check (
    exists (
      select 1 from public.crm_firm_members member
      where member.firm_id = crm_lead_roles.firm_id
        and member.user_id = (select auth.uid())
        and member.status = 'active'
        and member.role in ('owner', 'admin', 'lawyer')
    )
  );

create policy crm_lead_roles_update on public.crm_lead_roles
  for update to authenticated using (
    exists (
      select 1 from public.crm_firm_members member
      where member.firm_id = crm_lead_roles.firm_id
        and member.user_id = (select auth.uid())
        and member.status = 'active'
        and member.role in ('owner', 'admin', 'lawyer')
    )
  ) with check (
    exists (
      select 1 from public.crm_firm_members member
      where member.firm_id = crm_lead_roles.firm_id
        and member.user_id = (select auth.uid())
        and member.status = 'active'
        and member.role in ('owner', 'admin', 'lawyer')
    )
  );

revoke all on public.crm_lead_roles from public, anon, authenticated;
grant select, insert, update on public.crm_lead_roles to authenticated;

notify pgrst, 'reload schema';
