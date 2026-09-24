create or replace function public.crm_update_contact_profile(
  target_contact_id uuid, target_expected_version integer, new_profile jsonb
)
returns public.crm_contacts
language plpgsql security definer set search_path = public as $$
declare result public.crm_contacts;
begin
  if auth.uid() is null or jsonb_typeof(new_profile) <> 'object' then
    raise exception 'Invalid profile update';
  end if;
  update public.crm_contacts c
    set details = coalesce(c.details, '{}'::jsonb) || jsonb_build_object('profile', new_profile),
        version = c.version + 1
    where c.id = target_contact_id and c.version = target_expected_version
      and exists (
        select 1 from public.crm_firm_members m
        where m.firm_id = c.firm_id and m.user_id = auth.uid()
          and m.status = 'active' and m.role in ('owner', 'admin', 'lawyer')
      )
    returning c.* into result;
  if not found then
    raise exception 'Contact changed or unavailable; reload before saving' using errcode = '40001';
  end if;
  return result;
end;
$$;
revoke all on function public.crm_update_contact_profile(uuid, integer, jsonb) from public, anon;
grant execute on function public.crm_update_contact_profile(uuid, integer, jsonb) to authenticated;

notify pgrst, 'reload schema';