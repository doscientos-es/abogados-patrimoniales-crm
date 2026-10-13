create table public.crm_quote_services (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  code text not null check (char_length(trim(code)) between 1 and 80),
  name text not null check (char_length(trim(name)) between 1 and 500),
  description text not null default '',
  family text not null default 'Otros',
  price_cents bigint not null default 0 check (price_cents >= 0),
  vat_pct numeric check (vat_pct is null or vat_pct between 0 and 100),
  withholding_pct numeric check (withholding_pct is null or withholding_pct between 0 and 100),
  cost_cents bigint not null default 0 check (cost_cents >= 0),
  active boolean not null default true,
  source_data jsonb not null default '{}'::jsonb check (jsonb_typeof(source_data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index crm_quote_services_firm_code_idx
  on public.crm_quote_services (firm_id, lower(trim(code)));
create index crm_quote_services_firm_active_idx
  on public.crm_quote_services (firm_id, active, lower(name));

create table public.crm_engagement_blocks (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 240),
  body text not null default '' check (char_length(body) <= 20000),
  sort_order integer not null default 0,
  active boolean not null default true,
  include_by_default boolean not null default false,
  reviewed boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crm_engagement_blocks_firm_order_idx
  on public.crm_engagement_blocks (firm_id, archived, sort_order);

create table public.crm_quote_email_templates (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  subject text not null default '' check (char_length(subject) <= 500),
  body text not null default '' check (char_length(body) <= 20000),
  active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index crm_quote_email_templates_active_name_idx
  on public.crm_quote_email_templates (firm_id, lower(trim(name))) where active;
create index crm_quote_email_templates_firm_name_idx
  on public.crm_quote_email_templates (firm_id, lower(name));
create unique index crm_quote_email_templates_one_default_idx
  on public.crm_quote_email_templates (firm_id) where active and is_default;

create trigger crm_quote_services_updated_at
before update on public.crm_quote_services
for each row execute function public.crm_catalog_set_updated_at();
create trigger crm_engagement_blocks_updated_at
before update on public.crm_engagement_blocks
for each row execute function public.crm_catalog_set_updated_at();
create trigger crm_quote_email_templates_updated_at
before update on public.crm_quote_email_templates
for each row execute function public.crm_catalog_set_updated_at();

alter table public.crm_quote_services enable row level security;
alter table public.crm_engagement_blocks enable row level security;
alter table public.crm_quote_email_templates enable row level security;

create policy crm_quote_services_member_read on public.crm_quote_services
  for select to authenticated using (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_quote_services.firm_id and m.user_id = (select auth.uid()) and m.status = 'active')
  );
create policy crm_quote_services_admin_manage on public.crm_quote_services
  for all to authenticated using (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_quote_services.firm_id and m.user_id = (select auth.uid())
        and m.status = 'active' and m.role in ('owner', 'admin', 'lawyer'))
  ) with check (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_quote_services.firm_id and m.user_id = (select auth.uid())
        and m.status = 'active' and m.role in ('owner', 'admin', 'lawyer'))
  );

create policy crm_engagement_blocks_member_read on public.crm_engagement_blocks
  for select to authenticated using (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_engagement_blocks.firm_id and m.user_id = (select auth.uid()) and m.status = 'active')
  );
create policy crm_engagement_blocks_admin_manage on public.crm_engagement_blocks
  for all to authenticated using (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_engagement_blocks.firm_id and m.user_id = (select auth.uid())
        and m.status = 'active' and m.role in ('owner', 'admin', 'lawyer'))
  ) with check (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_engagement_blocks.firm_id and m.user_id = (select auth.uid())
        and m.status = 'active' and m.role in ('owner', 'admin', 'lawyer'))
  );

create policy crm_quote_email_templates_member_read on public.crm_quote_email_templates
  for select to authenticated using (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_quote_email_templates.firm_id and m.user_id = (select auth.uid()) and m.status = 'active')
  );
create policy crm_quote_email_templates_admin_manage on public.crm_quote_email_templates
  for all to authenticated using (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_quote_email_templates.firm_id and m.user_id = (select auth.uid())
        and m.status = 'active' and m.role in ('owner', 'admin', 'lawyer'))
  ) with check (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_quote_email_templates.firm_id and m.user_id = (select auth.uid())
        and m.status = 'active' and m.role in ('owner', 'admin', 'lawyer'))
  );

revoke all on public.crm_quote_services, public.crm_engagement_blocks, public.crm_quote_email_templates
  from public, anon, authenticated;
grant select, insert, update, delete on public.crm_quote_services,
  public.crm_engagement_blocks, public.crm_quote_email_templates to authenticated;

create or replace function public.crm_set_default_quote_template(target_template_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare target_firm uuid;
begin
  select firm_id into target_firm from public.crm_quote_email_templates
    where id = target_template_id and active;
  if target_firm is null then raise exception 'Active quote template not found'; end if;
  if not exists (
    select 1 from public.crm_firm_members m where m.firm_id = target_firm
      and m.user_id = (select auth.uid()) and m.status = 'active'
      and m.role in ('owner', 'admin', 'lawyer')
  ) then raise exception 'Forbidden'; end if;
  perform 1 from public.crm_firms where id = target_firm for update;
  perform 1 from public.crm_quote_email_templates
    where id = target_template_id and firm_id = target_firm and active for update;
  update public.crm_quote_email_templates set is_default = false
    where firm_id = target_firm and is_default;
  update public.crm_quote_email_templates set is_default = true
    where id = target_template_id and firm_id = target_firm and active;
end;
$$;
revoke all on function public.crm_set_default_quote_template(uuid) from public, anon;
grant execute on function public.crm_set_default_quote_template(uuid) to authenticated;

notify pgrst, 'reload schema';