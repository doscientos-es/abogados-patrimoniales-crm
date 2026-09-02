-- Billing and internal procedures: firm-isolated, audit-ready, and free of demo data.
alter table public.crm_firms
  add column if not exists invoice_sequence integer not null default 0 check (invoice_sequence >= 0);

create table public.crm_invoices (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete restrict,
  case_id uuid not null,
  contact_id uuid not null,
  series text not null default 'A' check (series ~ '^[A-Za-z0-9_-]{1,12}$'),
  fiscal_year integer not null default extract(year from current_date) check (fiscal_year between 2000 and 9999),
  invoice_number integer not null,
  reference text generated always as (series || '-' || fiscal_year::text || '-' || lpad(invoice_number::text, 6, '0')) stored,
  recipient_name text not null default '' check (char_length(trim(recipient_name)) <= 240),
  concept text not null check (char_length(trim(concept)) between 1 and 500),
  currency char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  net_amount numeric(14, 2) not null default 0 check (net_amount >= 0),
  tax_amount numeric(14, 2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(14, 2) generated always as (net_amount + tax_amount) stored,
  issued_on date not null default current_date,
  due_on date,
  paid_on date,
  status text not null default 'draft' check (status in ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled', 'written_off')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  version integer not null default 1 check (version > 0),
  created_by uuid references public.crm_profiles(id) on delete set null,
  updated_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, series, fiscal_year, invoice_number),
  unique (firm_id, id),
  foreign key (firm_id, case_id) references public.crm_cases(firm_id, id) on delete restrict,
  foreign key (firm_id, contact_id) references public.crm_contacts(firm_id, id) on delete restrict,
  check (due_on is null or due_on >= issued_on),
  check (paid_on is null or paid_on >= issued_on),
  check (status <> 'paid' or paid_on is not null)
);

create table public.crm_procedures (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(trim(title)) between 1 and 240),
  phase text not null check (char_length(trim(phase)) between 1 and 120),
  description text not null default '' check (char_length(trim(description)) <= 2000),
  sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  version integer not null default 1 check (version > 0),
  created_by uuid references public.crm_profiles(id) on delete set null,
  updated_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, slug),
  unique (firm_id, id)
);

create or replace function public.crm_assign_invoice_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.invoice_number is null then
    update public.crm_firms
    set invoice_sequence = invoice_sequence + 1
    where id = new.firm_id
    returning invoice_sequence into new.invoice_number;
  end if;
  return new;
end;
$$;

create trigger crm_invoices_assign_number
  before insert on public.crm_invoices
  for each row execute function public.crm_assign_invoice_number();
create trigger crm_invoices_audit
  before insert on public.crm_invoices
  for each row execute function public.crm_assign_contact_audit();
create trigger crm_invoices_touch
  before update on public.crm_invoices
  for each row execute function public.crm_touch_entity();
create trigger crm_invoices_scope_immutable
  before update on public.crm_invoices
  for each row execute function public.crm_reject_entity_scope_change();

create trigger crm_procedures_audit
  before insert on public.crm_procedures
  for each row execute function public.crm_assign_contact_audit();
create trigger crm_procedures_touch
  before update on public.crm_procedures
  for each row execute function public.crm_touch_entity();
create trigger crm_procedures_scope_immutable
  before update on public.crm_procedures
  for each row execute function public.crm_reject_entity_scope_change();

alter table public.crm_invoices enable row level security;
alter table public.crm_procedures enable row level security;

create policy crm_invoices_read on public.crm_invoices
  for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_invoices_create on public.crm_invoices
  for insert to authenticated
  with check (public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]));
create policy crm_invoices_update on public.crm_invoices
  for update to authenticated
  using (public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]))
  with check (public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]));

create policy crm_procedures_read on public.crm_procedures
  for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_procedures_create on public.crm_procedures
  for insert to authenticated
  with check (public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]));
create policy crm_procedures_update on public.crm_procedures
  for update to authenticated
  using (public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]))
  with check (public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]));

revoke delete on public.crm_invoices, public.crm_procedures from authenticated;
grant select, insert, update on public.crm_invoices, public.crm_procedures to authenticated;

create index crm_invoices_firm_issued_idx
  on public.crm_invoices (firm_id, issued_on desc, created_at desc);
create index crm_invoices_firm_open_due_idx
  on public.crm_invoices (firm_id, due_on)
  where status in ('issued', 'partially_paid', 'overdue');
create index crm_invoices_firm_case_idx
  on public.crm_invoices (firm_id, case_id, issued_on desc);
create index crm_procedures_firm_active_idx
  on public.crm_procedures (firm_id, phase, title)
  where status = 'active';