-- An Auth-user deletion cascades through crm_profiles and releases these audit references.
alter table public.crm_opportunities
  drop constraint if exists crm_opportunities_archived_by_fkey;

alter table public.crm_opportunities
  add constraint crm_opportunities_archived_by_fkey
  foreign key (archived_by) references public.crm_profiles(id) on delete set null;

-- Permanent deletion is performed by the JWT-protected Edge Function so it also deletes auth.users.
revoke execute on function public.crm_delete_firm_member(uuid, uuid) from authenticated;