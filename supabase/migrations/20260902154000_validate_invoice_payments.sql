-- Keep invoice balances and payment status consistent under concurrent writes.
create or replace function public.crm_validate_invoice_payment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  invoice_total numeric(14, 2);
  invoice_status text;
  paid_total numeric(14, 2);
begin
  select total_amount, status
  into invoice_total, invoice_status
  from public.crm_invoices
  where firm_id = new.firm_id and id = new.invoice_id
  for update;

  if not found then
    raise exception 'Payment invoice must belong to the same firm';
  end if;
  if invoice_status not in ('issued', 'partially_paid', 'overdue') then
    raise exception 'Only issued invoices can receive payments';
  end if;

  select coalesce(sum(amount), 0)
  into paid_total
  from public.crm_invoice_payments
  where firm_id = new.firm_id and invoice_id = new.invoice_id;

  if paid_total + new.amount > invoice_total then
    raise exception 'Payment amount exceeds the outstanding invoice balance';
  end if;
  return new;
end;
$$;

create or replace function public.crm_apply_invoice_payment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  paid_total numeric(14, 2);
  settled_on date;
begin
  select coalesce(sum(amount), 0), max(received_on)
  into paid_total, settled_on
  from public.crm_invoice_payments
  where firm_id = new.firm_id and invoice_id = new.invoice_id;

  update public.crm_invoices
  set
    status = case when paid_total >= total_amount then 'paid' else 'partially_paid' end,
    paid_on = case when paid_total >= total_amount then settled_on else null end
  where firm_id = new.firm_id and id = new.invoice_id;

  return new;
end;
$$;

create trigger crm_invoice_payments_validate
  before insert on public.crm_invoice_payments
  for each row execute function public.crm_validate_invoice_payment();
create trigger crm_invoice_payments_apply
  after insert on public.crm_invoice_payments
  for each row execute function public.crm_apply_invoice_payment();