-- Prevent cross-firm record moves and restrict firm administration.
create or replace function public.crm_has_firm_role(
  target_firm_id uuid,
  allowed_roles public.crm_member_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.crm_firm_members
    where firm_id = target_firm_id
      and user_id = auth.uid()
      and status = 'active'
      and role = any(allowed_roles)
  );
$$;

create or replace function public.crm_prevent_firm_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.firm_id is distinct from new.firm_id then
    raise exception 'Records cannot be moved between firms';
  end if;
  return new;
end;
$$;

create trigger crm_contacts_prevent_firm_change
  before update on public.crm_contacts
  for each row execute function public.crm_prevent_firm_change();

create trigger crm_opportunities_prevent_firm_change
  before update on public.crm_opportunities
  for each row execute function public.crm_prevent_firm_change();

drop policy crm_firms_update on public.crm_firms;
create policy crm_firms_update on public.crm_firms
  for update
  using (public.crm_has_firm_role(id, array['owner', 'admin']::public.crm_member_role[]))
  with check (public.crm_has_firm_role(id, array['owner', 'admin']::public.crm_member_role[]));

revoke all on function public.crm_is_firm_member(uuid) from public, anon;
revoke all on function public.crm_shares_firm(uuid) from public, anon;
revoke all on function public.crm_has_firm_role(uuid, public.crm_member_role[]) from public, anon;
revoke all on function public.crm_bootstrap_firm(text) from public, anon;
grant execute on function public.crm_is_firm_member(uuid) to authenticated;
grant execute on function public.crm_shares_firm(uuid) to authenticated;
grant execute on function public.crm_has_firm_role(uuid, public.crm_member_role[]) to authenticated;
grant execute on function public.crm_bootstrap_firm(text) to authenticated;