-- Immutable payment ledger: invoice balances are derived from real receipts.
create table public.crm_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  invoice_id uuid not null,
  amount numeric(14, 2) not null check (amount > 0),
  received_on date not null default current_date,
  payment_method text not null default 'transfer' check (payment_method in ('transfer', 'card', 'cash', 'direct_debit', 'other')),
  external_reference text not null default '' check (char_length(trim(external_reference)) <= 240),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (firm_id, invoice_id) references public.crm_invoices(firm_id, id) on delete restrict
);

create or replace function public.crm_assign_record_creator()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.created_by = auth.uid();
  return new;
end;
$$;

create trigger crm_invoice_payments_audit
  before insert on public.crm_invoice_payments
  for each row execute function public.crm_assign_record_creator();

alter table public.crm_invoice_payments enable row level security;

create policy crm_invoice_payments_read on public.crm_invoice_payments
  for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_invoice_payments_create on public.crm_invoice_payments
  for insert to authenticated
  with check (public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]));

revoke update, delete on public.crm_invoice_payments from authenticated;
grant select, insert on public.crm_invoice_payments to authenticated;

create index crm_invoice_payments_firm_invoice_received_idx
  on public.crm_invoice_payments (firm_id, invoice_id, received_on desc);
create index crm_invoice_payments_firm_received_idx
  on public.crm_invoice_payments (firm_id, received_on desc);