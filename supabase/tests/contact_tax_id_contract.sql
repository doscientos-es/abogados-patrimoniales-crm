-- Run with a database-administrator connection. The transaction is rolled back.
begin;

insert into public.crm_firms (id, name)
values ('50000000-0000-4000-8000-000000000001', 'Contact tax ID contract');

insert into public.crm_contacts (firm_id, nature, relationship, display_name, tax_id)
values
  ('50000000-0000-4000-8000-000000000001', 'person', 'client', 'Contact without tax ID 1', null),
  ('50000000-0000-4000-8000-000000000001', 'person', 'client', 'Contact without tax ID 2', null),
  ('50000000-0000-4000-8000-000000000001', 'person', 'client', 'Contact without tax ID 3', null),
  ('50000000-0000-4000-8000-000000000001', 'person', 'client', 'Contact with tax ID', 'X-123');

do $$
declare
  duplicate_rejected boolean := false;
begin
  if (
    select count(*)
    from public.crm_contacts
    where firm_id = '50000000-0000-4000-8000-000000000001' and tax_id is null
  ) <> 3 then
    raise exception 'Multiple contacts without a tax ID should be allowed';
  end if;

  begin
    insert into public.crm_contacts (firm_id, nature, relationship, display_name, tax_id)
    values (
      '50000000-0000-4000-8000-000000000001',
      'person',
      'client',
      'Duplicate tax ID',
      ' x-123 '
    );
  exception when unique_violation then
    duplicate_rejected := true;
  end;

  if not duplicate_rejected then
    raise exception 'Tax ID uniqueness should ignore case and surrounding whitespace';
  end if;
end;
$$;

rollback;