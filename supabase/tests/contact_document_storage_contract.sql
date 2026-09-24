-- Run with a database-administrator connection after all migrations.
do $$
declare storage_read_policy text;
begin
  select qual into storage_read_policy
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname = 'crm_contact_documents_storage_select';

  if storage_read_policy is null then
    raise exception 'Contact document storage read policy is missing';
  end if;

  if position('objects.name' in storage_read_policy) = 0
    or position('d.storage_path = d.name' in storage_read_policy) > 0 then
    raise exception 'Contact document storage policy must match the object name to storage_path';
  end if;
end;
$$;