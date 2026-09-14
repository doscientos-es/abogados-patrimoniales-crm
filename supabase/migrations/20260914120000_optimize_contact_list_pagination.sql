-- Keep each server-paginated contact sort on an index-backed access path.
create index if not exists crm_contacts_active_name_page_idx
  on public.crm_contacts (firm_id, display_name, id)
  where status <> 'archived';

create index if not exists crm_contacts_active_relationship_page_idx
  on public.crm_contacts (firm_id, relationship, display_name, id)
  where status <> 'archived';

create index if not exists crm_contacts_active_created_page_idx
  on public.crm_contacts (firm_id, created_at desc, id desc)
  where status <> 'archived';

create index if not exists crm_contacts_active_updated_page_idx
  on public.crm_contacts (firm_id, updated_at desc, id desc)
  where status <> 'archived';

create index if not exists crm_contacts_firm_source_idx
  on public.crm_contacts (firm_id, source)
  where source is not null;