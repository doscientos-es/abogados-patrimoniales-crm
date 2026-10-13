do $$
declare
  existing_constraint text;
begin
  if exists (
    select 1
    from public.crm_contacts
    where tax_id is not null and trim(tax_id) <> ''
    group by firm_id, upper(trim(tax_id))
    having count(*) > 1
  ) then
    raise exception 'Duplicate normalized contact tax IDs exist; resolve them before applying this migration';
  end if;

  for existing_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.crm_contacts'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike 'UNIQUE% (firm_id, tax_id)'
  loop
    execute format('alter table public.crm_contacts drop constraint %I', existing_constraint);
  end loop;
end $$;

update public.crm_contacts
set tax_id = null
where tax_id is not null and trim(tax_id) = '';

create unique index if not exists crm_contacts_firm_tax_id_key
  on public.crm_contacts (firm_id, upper(trim(tax_id)))
  where tax_id is not null and trim(tax_id) <> '';