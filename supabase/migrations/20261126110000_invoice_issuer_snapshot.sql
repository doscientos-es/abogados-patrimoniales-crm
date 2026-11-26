-- Capture the issuer at issuance, including direct credit-note inserts. Historical invoices
-- are deliberately not backfilled from today's settings.
create or replace function public.crm_capture_invoice_issuer()
returns trigger language plpgsql set search_path = public as $$
declare issuer public.crm_firm_settings;
begin
  if new.status <> 'issued' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.status <> 'draft' then return new; end if;
  end if;

  select * into issuer from public.crm_firm_settings where firm_id = new.firm_id;
  if not found or trim(issuer.legal_name) = '' or trim(issuer.tax_id) = ''
    or trim(issuer.address) = '' or trim(issuer.professional_registration) = '' then
    raise exception 'Completa la razón social, el NIF, el domicilio y la colegiación del despacho en Configuración antes de emitir.';
  end if;

  new.details := jsonb_set(new.details, '{datos_emisor}', jsonb_build_object(
    'legal_name', trim(issuer.legal_name),
    'tax_id', trim(issuer.tax_id),
    'address', trim(issuer.address),
    'professional_registration', trim(issuer.professional_registration)
  ), true);
  return new;
end;
$$;

revoke all on function public.crm_capture_invoice_issuer() from public, anon, authenticated;
create trigger crm_invoices_capture_issuer
before insert or update on public.crm_invoices
for each row execute function public.crm_capture_invoice_issuer();
