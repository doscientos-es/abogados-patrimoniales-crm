do $$
declare
  rls_enabled boolean;
  unique_index text;
  read_policy text;
  insert_policy text;
  update_policy text;
begin
  select c.relrowsecurity into rls_enabled
  from pg_class c
  where c.oid = 'public.crm_lead_roles'::regclass;
  if rls_enabled is distinct from true then
    raise exception 'Lead role catalog must enforce row-level security';
  end if;

  select indexdef into unique_index
  from pg_indexes
  where schemaname = 'public' and tablename = 'crm_lead_roles'
    and indexname = 'crm_lead_roles_active_name_idx';
  if unique_index is null or position('UNIQUE' in upper(unique_index)) = 0
    or position('LOWER' in upper(unique_index)) = 0
    or position('TRIM' in upper(unique_index)) = 0
    or position('NAME' in upper(unique_index)) = 0 then
    raise exception 'Active role names must be unique after trimming and case normalization';
  end if;

  select qual into read_policy from pg_policies
  where schemaname = 'public' and tablename = 'crm_lead_roles' and policyname = 'crm_lead_roles_read';
  select with_check into insert_policy from pg_policies
  where schemaname = 'public' and tablename = 'crm_lead_roles' and policyname = 'crm_lead_roles_insert';
  select with_check into update_policy from pg_policies
  where schemaname = 'public' and tablename = 'crm_lead_roles' and policyname = 'crm_lead_roles_update';

  if read_policy is null or position('crm_firm_members' in read_policy) = 0
    or position('active' in read_policy) = 0 then
    raise exception 'Reading roles must require active membership in the same firm';
  end if;
  if insert_policy is null or position('crm_firm_members' in insert_policy) = 0
    or position('owner' in insert_policy) = 0 or position('admin' in insert_policy) = 0
    or position('lawyer' in insert_policy) = 0 then
    raise exception 'Creating roles must require an authorized active firm member';
  end if;
  if update_policy is null or position('crm_firm_members' in update_policy) = 0
    or position('active' in update_policy) = 0 then
    raise exception 'Updating roles must require an authorized active firm member';
  end if;
  if has_table_privilege('authenticated', 'public.crm_lead_roles', 'DELETE') then
    raise exception 'Role catalog entries must be archived, not deleted';
  end if;
end;
$$;