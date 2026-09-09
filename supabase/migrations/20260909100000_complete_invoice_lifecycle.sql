-- Facturación completa: líneas, numeración en la emisión, inmutabilidad fiscal y rectificativas.
alter table public.crm_invoices
  add column if not exists kind text not null default 'standard'
    check (kind in ('standard', 'credit_note')),
  add column if not exists rectifies_invoice_id uuid,
  add column if not exists cancellation_reason text not null default ''
    check (char_length(trim(cancellation_reason)) <= 500),
  add column if not exists issued_at timestamptz;

alter table public.crm_invoices
  add constraint crm_invoices_rectifies_scope_fkey
  foreign key (firm_id, rectifies_invoice_id) references public.crm_invoices(firm_id, id) on delete restrict;

drop trigger if exists crm_invoices_assign_number on public.crm_invoices;
drop function if exists public.crm_assign_invoice_number();

alter table public.crm_invoices drop column reference;
alter table public.crm_invoices alter column invoice_number drop not null;
alter table public.crm_invoices
  add column reference text generated always as (
    case
      when invoice_number is null then 'BORRADOR-' || left(id::text, 8)
      else series || '-' || fiscal_year::text || '-' || lpad(invoice_number::text, 6, '0')
    end
  ) stored;
alter table public.crm_invoices
  add constraint crm_invoices_number_required_check
  check (invoice_number is not null or status in ('draft', 'cancelled'));

create index crm_invoices_firm_rectifies_idx
  on public.crm_invoices (firm_id, rectifies_invoice_id)
  where rectifies_invoice_id is not null;
create index crm_invoices_global_search_idx
  on public.crm_invoices using gin ((lower(reference || ' ' || recipient_name || ' ' || concept)) gin_trgm_ops);

create table public.crm_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  invoice_id uuid not null,
  line_number integer not null check (line_number between 1 and 200),
  description text not null check (char_length(trim(description)) between 1 and 500),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  tax_rate numeric(5, 2) not null default 21 check (tax_rate between 0 and 100),
  net_amount numeric(14, 2) generated always as (round(quantity * unit_price, 2)) stored,
  tax_amount numeric(14, 2) generated always as (round(round(quantity * unit_price, 2) * tax_rate / 100, 2)) stored,
  created_at timestamptz not null default now(),
  unique (firm_id, invoice_id, line_number),
  foreign key (firm_id, invoice_id) references public.crm_invoices(firm_id, id) on delete cascade
);

alter table public.crm_invoice_lines enable row level security;
create policy crm_invoice_lines_read on public.crm_invoice_lines
  for select to authenticated using (public.crm_is_firm_member(firm_id));
revoke insert, update, delete on public.crm_invoice_lines from authenticated;
grant select on public.crm_invoice_lines to authenticated;

-- Una factura emitida solo admite cambios de estado, cobro y motivo de anulación.
create or replace function public.crm_protect_issued_invoice()
returns trigger language plpgsql set search_path = public as $$
declare mutable_keys text[] := array['status', 'paid_on', 'cancellation_reason', 'version', 'updated_at', 'updated_by'];
begin
  if old.status = 'draft' then return new; end if;
  if to_jsonb(old) - mutable_keys <> to_jsonb(new) - mutable_keys then
    raise exception 'An issued invoice cannot be modified; register a credit note instead';
  end if;
  return new;
end;
$$;

create trigger crm_invoices_protect_issued
  before update on public.crm_invoices
  for each row execute function public.crm_protect_issued_invoice();

drop policy if exists crm_invoices_create on public.crm_invoices;
drop policy if exists crm_invoices_update on public.crm_invoices;
drop policy if exists crm_invoice_payments_create on public.crm_invoice_payments;
revoke insert, update on public.crm_invoices from authenticated;
revoke insert on public.crm_invoice_payments from authenticated;

create or replace function public.crm_replace_invoice_lines(target_invoice public.crm_invoices, new_lines jsonb)
returns public.crm_invoices language plpgsql set search_path = public as $$
declare line jsonb; line_index integer := 0; totals record; saved public.crm_invoices;
begin
  if jsonb_typeof(new_lines) <> 'array' or jsonb_array_length(new_lines) = 0 then
    raise exception 'An invoice needs at least one line';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new_lines) as candidate
    where trim(coalesce(candidate ->> 'description', '')) = ''
       or coalesce((candidate ->> 'quantity')::numeric, 0) <= 0
       or coalesce((candidate ->> 'unit_price')::numeric, -1) < 0
  ) then
    raise exception 'Every line needs a description, a positive quantity and a valid price';
  end if;
  delete from public.crm_invoice_lines where firm_id = target_invoice.firm_id and invoice_id = target_invoice.id;
  for line in select * from jsonb_array_elements(new_lines) loop
    line_index := line_index + 1;
    insert into public.crm_invoice_lines (firm_id, invoice_id, line_number, description, quantity, unit_price, tax_rate)
    values (
      target_invoice.firm_id, target_invoice.id, line_index,
      trim(coalesce(line ->> 'description', '')),
      coalesce((line ->> 'quantity')::numeric, 0),
      coalesce((line ->> 'unit_price')::numeric, 0),
      coalesce((line ->> 'tax_rate')::numeric, 0)
    );
  end loop;
  select coalesce(sum(net_amount), 0) as net, coalesce(sum(tax_amount), 0) as tax
  into totals
  from public.crm_invoice_lines
  where firm_id = target_invoice.firm_id and invoice_id = target_invoice.id;
  update public.crm_invoices set net_amount = totals.net, tax_amount = totals.tax
  where id = target_invoice.id returning * into saved;
  return saved;
end;
$$;

revoke all on function public.crm_replace_invoice_lines(public.crm_invoices, jsonb) from public, anon, authenticated;

create or replace function public.crm_save_invoice_draft(
  target_firm_id uuid, target_invoice_id uuid, target_expected_version integer,
  target_case_id uuid, target_contact_id uuid, new_recipient_name text, new_concept text,
  new_currency text, new_issued_on date, new_due_on date, new_lines jsonb
)
returns public.crm_invoices language plpgsql security definer set search_path = public as $$
declare current_record public.crm_invoices; saved public.crm_invoices;
begin
  if auth.uid() is null then raise exception 'Forbidden'; end if;
  if trim(coalesce(new_concept, '')) = '' then raise exception 'The invoice concept is required'; end if;
  if new_due_on is not null and new_due_on < coalesce(new_issued_on, current_date) then
    raise exception 'The due date cannot precede the invoice date';
  end if;
  if target_invoice_id is null then
    if not public.crm_has_firm_role(target_firm_id, array['owner', 'admin']::public.crm_member_role[]) then
      raise exception 'Forbidden';
    end if;
    insert into public.crm_invoices (
      firm_id, case_id, contact_id, recipient_name, concept, currency, issued_on, due_on, status
    ) values (
      target_firm_id, target_case_id, target_contact_id, trim(coalesce(new_recipient_name, '')),
      trim(coalesce(new_concept, '')), upper(coalesce(nullif(trim(new_currency), ''), 'EUR')),
      coalesce(new_issued_on, current_date), new_due_on, 'draft'
    ) returning * into saved;
  else
    select * into current_record from public.crm_invoices where id = target_invoice_id for update;
    if not found or not public.crm_has_firm_role(current_record.firm_id, array['owner', 'admin']::public.crm_member_role[]) then
      raise exception 'Invoice not found';
    end if;
    if current_record.status <> 'draft' then raise exception 'Only draft invoices can be edited'; end if;
    if current_record.version <> target_expected_version then
      raise exception 'Invoice changed by another user; reload before saving' using errcode = '40001';
    end if;
    update public.crm_invoices set
      case_id = target_case_id, contact_id = target_contact_id,
      recipient_name = trim(coalesce(new_recipient_name, '')), concept = trim(coalesce(new_concept, '')),
      currency = upper(coalesce(nullif(trim(new_currency), ''), 'EUR')),
      issued_on = coalesce(new_issued_on, current_date), due_on = new_due_on
    where id = current_record.id returning * into saved;
  end if;
  return public.crm_replace_invoice_lines(saved, new_lines);
end;
$$;

create or replace function public.crm_issue_invoice(
  target_invoice_id uuid, target_expected_version integer, new_issued_on date, new_due_on date
)
returns public.crm_invoices language plpgsql security definer set search_path = public as $$
declare current_record public.crm_invoices; saved public.crm_invoices; next_number integer; issue_date date;
begin
  select * into current_record from public.crm_invoices where id = target_invoice_id for update;
  if not found or not public.crm_has_firm_role(current_record.firm_id, array['owner', 'admin']::public.crm_member_role[]) then
    raise exception 'Invoice not found';
  end if;
  if current_record.status <> 'draft' then raise exception 'Only draft invoices can be issued'; end if;
  if current_record.version <> target_expected_version then
    raise exception 'Invoice changed by another user; reload before issuing' using errcode = '40001';
  end if;
  if current_record.total_amount <= 0 then raise exception 'An invoice cannot be issued with a zero total'; end if;
  if not exists (select 1 from public.crm_invoice_lines where invoice_id = current_record.id) then
    raise exception 'An invoice needs at least one line';
  end if;
  issue_date := coalesce(new_issued_on, current_date);
  if new_due_on is not null and new_due_on < issue_date then
    raise exception 'The due date cannot precede the invoice date';
  end if;
  update public.crm_firms set invoice_sequence = invoice_sequence + 1
  where id = current_record.firm_id returning invoice_sequence into next_number;
  update public.crm_invoices set
    invoice_number = next_number, fiscal_year = extract(year from issue_date)::integer,
    issued_on = issue_date, due_on = new_due_on, status = 'issued', issued_at = now()
  where id = current_record.id returning * into saved;
  return saved;
end;
$$;

create or replace function public.crm_discard_invoice_draft(
  target_invoice_id uuid, target_expected_version integer, discard_reason text
)
returns public.crm_invoices language plpgsql security definer set search_path = public as $$
declare current_record public.crm_invoices; saved public.crm_invoices;
begin
  select * into current_record from public.crm_invoices where id = target_invoice_id for update;
  if not found or not public.crm_has_firm_role(current_record.firm_id, array['owner', 'admin']::public.crm_member_role[]) then
    raise exception 'Invoice not found';
  end if;
  if current_record.status <> 'draft' then raise exception 'Only draft invoices can be discarded'; end if;
  if current_record.version <> target_expected_version then
    raise exception 'Invoice changed by another user; reload before discarding' using errcode = '40001';
  end if;
  update public.crm_invoices set status = 'cancelled', cancellation_reason = trim(coalesce(discard_reason, ''))
  where id = current_record.id returning * into saved;
  return saved;
end;
$$;

create or replace function public.crm_register_invoice_payment(
  target_invoice_id uuid, new_amount numeric, new_received_on date,
  new_payment_method text, new_external_reference text
)
returns public.crm_invoice_payments language plpgsql security definer set search_path = public as $$
declare current_record public.crm_invoices; saved public.crm_invoice_payments;
begin
  select * into current_record from public.crm_invoices where id = target_invoice_id;
  if not found or not public.crm_has_firm_role(current_record.firm_id, array['owner', 'admin']::public.crm_member_role[]) then
    raise exception 'Invoice not found';
  end if;
  if current_record.kind <> 'standard' then raise exception 'A credit note cannot receive payments'; end if;
  if new_amount is null or new_amount <= 0 then raise exception 'The payment amount must be positive'; end if;
  insert into public.crm_invoice_payments (
    firm_id, invoice_id, amount, received_on, payment_method, external_reference
  ) values (
    current_record.firm_id, current_record.id, round(new_amount, 2), coalesce(new_received_on, current_date),
    coalesce(nullif(trim(new_payment_method), ''), 'transfer'), trim(coalesce(new_external_reference, ''))
  ) returning * into saved;
  return saved;
end;
$$;

create or replace function public.crm_create_credit_note(
  target_invoice_id uuid, target_expected_version integer, rectification_reason text
)
returns public.crm_invoices language plpgsql security definer set search_path = public as $$
declare source public.crm_invoices; saved public.crm_invoices; next_number integer; reason text;
begin
  select * into source from public.crm_invoices where id = target_invoice_id for update;
  if not found or not public.crm_has_firm_role(source.firm_id, array['owner', 'admin']::public.crm_member_role[]) then
    raise exception 'Invoice not found';
  end if;
  if source.version <> target_expected_version then
    raise exception 'Invoice changed by another user; reload before rectifying' using errcode = '40001';
  end if;
  if source.kind <> 'standard' or source.invoice_number is null
    or source.status not in ('issued', 'partially_paid', 'paid', 'overdue') then
    raise exception 'Only issued invoices can be rectified';
  end if;
  if exists (select 1 from public.crm_invoices where firm_id = source.firm_id and rectifies_invoice_id = source.id) then
    raise exception 'This invoice already has a credit note';
  end if;
  reason := trim(coalesce(rectification_reason, ''));
  if reason = '' or char_length(reason) > 300 then raise exception 'A rectification reason is required'; end if;
  update public.crm_firms set invoice_sequence = invoice_sequence + 1
  where id = source.firm_id returning invoice_sequence into next_number;
  insert into public.crm_invoices (
    firm_id, case_id, contact_id, series, fiscal_year, invoice_number, recipient_name, concept,
    currency, net_amount, tax_amount, issued_on, status, kind, rectifies_invoice_id, issued_at
  ) values (
    source.firm_id, source.case_id, source.contact_id, source.series,
    extract(year from current_date)::integer, next_number, source.recipient_name,
    left('Rectificativa de ' || source.reference || ' · ' || reason, 500), source.currency,
    source.net_amount, source.tax_amount, current_date, 'issued', 'credit_note', source.id, now()
  ) returning * into saved;
  insert into public.crm_invoice_lines (firm_id, invoice_id, line_number, description, quantity, unit_price, tax_rate)
  select firm_id, saved.id, line_number, description, quantity, unit_price, tax_rate
  from public.crm_invoice_lines where firm_id = source.firm_id and invoice_id = source.id;
  if not exists (select 1 from public.crm_invoice_payments where invoice_id = source.id) then
    update public.crm_invoices set status = 'cancelled',
      cancellation_reason = left('Rectificada por ' || saved.reference || ' · ' || reason, 500)
    where id = source.id;
  end if;
  return saved;
end;
$$;

revoke all on function public.crm_save_invoice_draft(uuid, uuid, integer, uuid, uuid, text, text, text, date, date, jsonb) from public, anon;
revoke all on function public.crm_issue_invoice(uuid, integer, date, date) from public, anon;
revoke all on function public.crm_discard_invoice_draft(uuid, integer, text) from public, anon;
revoke all on function public.crm_register_invoice_payment(uuid, numeric, date, text, text) from public, anon;
revoke all on function public.crm_create_credit_note(uuid, integer, text) from public, anon;
grant execute on function public.crm_save_invoice_draft(uuid, uuid, integer, uuid, uuid, text, text, text, date, date, jsonb) to authenticated;
grant execute on function public.crm_issue_invoice(uuid, integer, date, date) to authenticated;
grant execute on function public.crm_discard_invoice_draft(uuid, integer, text) to authenticated;
grant execute on function public.crm_register_invoice_payment(uuid, numeric, date, text, text) to authenticated;
grant execute on function public.crm_create_credit_note(uuid, integer, text) to authenticated;
