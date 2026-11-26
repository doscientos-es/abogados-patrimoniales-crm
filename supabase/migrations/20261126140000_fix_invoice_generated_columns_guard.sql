-- Generated columns are null in BEFORE UPDATE triggers. Their source fields remain protected.
create or replace function public.crm_protect_issued_invoice()
returns trigger language plpgsql set search_path = public as $$
declare
  mutable_keys text[] := array[
    'status', 'paid_on', 'cancellation_reason', 'version', 'updated_at', 'updated_by',
    'total_amount', 'reference'
  ];
begin
  if old.status = 'draft' then return new; end if;
  if to_jsonb(old) - mutable_keys <> to_jsonb(new) - mutable_keys then
    raise exception 'An issued invoice cannot be modified; register a credit note instead';
  end if;
  return new;
end;
$$;