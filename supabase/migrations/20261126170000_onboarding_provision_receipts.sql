-- A receipt is recorded once and may be applied in full to one invoice payment.
-- Advances can be received before the invoice is issued; preserve the actual receipt date.
alter table public.crm_invoices drop constraint if exists crm_invoices_check1;

create table public.crm_onboarding_receipts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete restrict,
  onboarding_id uuid not null unique references public.crm_onboardings(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0 and amount <> 'NaN'::numeric),
  received_on date not null,
  payment_method text not null check (payment_method in ('transfer', 'card', 'cash', 'direct_debit', 'other')),
  external_reference text not null default '' check (char_length(trim(external_reference)) <= 240),
  invoice_payment_id uuid unique references public.crm_invoice_payments(id) on delete restrict,
  created_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  applied_by uuid references public.crm_profiles(id) on delete set null,
  applied_at timestamptz
);

alter table public.crm_onboarding_receipts enable row level security;
create policy crm_onboarding_receipts_read on public.crm_onboarding_receipts
  for select to authenticated using (public.crm_is_firm_member(firm_id));
revoke all on public.crm_onboarding_receipts from public, anon, authenticated;
grant select on public.crm_onboarding_receipts to authenticated;

-- Older clients must not advance the workflow without recording the receipt.
create function public.crm_require_onboarding_receipt()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.payment_confirmed_on is null and new.payment_confirmed_on is not null
    and not exists (select 1 from public.crm_onboarding_receipts r
      where r.onboarding_id = new.id and r.firm_id = new.firm_id
        and r.received_on = new.payment_confirmed_on) then
    raise exception 'Record the provision receipt before confirming payment';
  end if;
  return new;
end;
$$;
create trigger crm_onboardings_require_receipt before update on public.crm_onboardings
  for each row execute function public.crm_require_onboarding_receipt();

create function public.crm_confirm_onboarding_receipt(
  target_onboarding_id uuid, target_expected_version integer, new_amount numeric,
  new_received_on date, new_payment_method text, new_external_reference text
)
returns public.crm_onboardings language plpgsql security definer set search_path = public as $$
declare current_record public.crm_onboardings; saved public.crm_onboardings;
begin
  select * into current_record from public.crm_onboardings where id = target_onboarding_id for update;
  if not found or not public.crm_is_firm_member(current_record.firm_id) then
    raise exception 'Onboarding not found';
  end if;
  if current_record.version is distinct from target_expected_version then
    raise exception 'Onboarding changed by another user; reload before advancing' using errcode = '40001';
  end if;
  if current_record.phase <> 'proforma' or current_record.payment_confirmed_on is not null then
    raise exception 'Invalid onboarding transition';
  end if;
  if new_amount is null or new_amount = 'NaN'::numeric or new_amount <= 0 or new_amount <> round(new_amount, 2)
    or new_received_on is null or new_payment_method is null
    or new_payment_method not in ('transfer', 'card', 'cash', 'direct_debit', 'other') then
    raise exception 'Valid receipt amount, date and method are required';
  end if;
  insert into public.crm_onboarding_receipts
    (firm_id, onboarding_id, amount, received_on, payment_method, external_reference, created_by)
  values (current_record.firm_id, current_record.id, new_amount, new_received_on, new_payment_method,
    trim(coalesce(new_external_reference, '')), auth.uid());
  select * into saved from public.crm_transition_onboarding(
    current_record.id, target_expected_version, 'payment_confirmed', new_received_on, null, null);
  return saved;
end;
$$;

-- Passing an existing payment links it without adding another ledger entry.
create function public.crm_apply_onboarding_receipt(
  target_receipt_id uuid, target_invoice_id uuid, existing_payment_id uuid default null
)
returns void language plpgsql security definer set search_path = public as $$
declare receipt public.crm_onboarding_receipts; onboarding public.crm_onboardings;
  invoice public.crm_invoices; payment public.crm_invoice_payments;
begin
  select * into receipt from public.crm_onboarding_receipts where id = target_receipt_id for update;
  if not found or not public.crm_has_firm_role(receipt.firm_id, array['owner', 'admin']::public.crm_member_role[]) then
    raise exception 'Receipt not found';
  end if;
  if receipt.invoice_payment_id is not null then raise exception 'Receipt already applied'; end if;
  select * into onboarding from public.crm_onboardings where id = receipt.onboarding_id and firm_id = receipt.firm_id for update;
  select * into invoice from public.crm_invoices where id = target_invoice_id and firm_id = receipt.firm_id for update;
  if not found or onboarding.case_id is null or invoice.case_id <> onboarding.case_id
    or invoice.contact_id <> onboarding.contact_id or invoice.currency <> 'EUR' or invoice.kind <> 'standard' then
    raise exception 'Invoice must belong to the same case and client and use EUR';
  end if;
  if existing_payment_id is null then
    select * into payment from public.crm_register_invoice_payment(
      invoice.id, receipt.amount, receipt.received_on, receipt.payment_method, receipt.external_reference);
  else
    select * into payment from public.crm_invoice_payments
      where id = existing_payment_id and invoice_id = invoice.id and firm_id = receipt.firm_id;
    if not found or payment.amount <> receipt.amount or payment.received_on <> receipt.received_on
      or payment.payment_method <> receipt.payment_method then
      raise exception 'Existing payment must match the receipt amount, date and method';
    end if;
  end if;
  update public.crm_onboarding_receipts set invoice_payment_id = payment.id, applied_by = auth.uid(), applied_at = now()
    where id = receipt.id;
  insert into public.crm_onboarding_events (firm_id, onboarding_id, event_type, payload)
    values (receipt.firm_id, onboarding.id, 'receipt_applied', jsonb_build_object('invoice_id', invoice.id, 'payment_id', payment.id));
end;
$$;

revoke all on function public.crm_require_onboarding_receipt() from public, anon, authenticated;
revoke all on function public.crm_confirm_onboarding_receipt(uuid, integer, numeric, date, text, text) from public, anon;
revoke all on function public.crm_apply_onboarding_receipt(uuid, uuid, uuid) from public, anon;
grant execute on function public.crm_confirm_onboarding_receipt(uuid, integer, numeric, date, text, text) to authenticated;
grant execute on function public.crm_apply_onboarding_receipt(uuid, uuid, uuid) to authenticated;
notify pgrst, 'reload schema';
