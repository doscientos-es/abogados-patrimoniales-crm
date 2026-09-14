-- Keep member read access separate from administrative write access so RLS does
-- not evaluate overlapping permissive SELECT policies for Drive connections.
drop policy if exists crm_drive_connections_manage on public.crm_drive_connections;

create policy crm_drive_connections_insert on public.crm_drive_connections
  for insert to authenticated
  with check (public.crm_has_firm_role(
    firm_id, array['owner', 'admin']::public.crm_member_role[]
  ));

create policy crm_drive_connections_update on public.crm_drive_connections
  for update to authenticated
  using (public.crm_has_firm_role(
    firm_id, array['owner', 'admin']::public.crm_member_role[]
  ))
  with check (public.crm_has_firm_role(
    firm_id, array['owner', 'admin']::public.crm_member_role[]
  ));

create policy crm_drive_connections_delete on public.crm_drive_connections
  for delete to authenticated
  using (public.crm_has_firm_role(
    firm_id, array['owner', 'admin']::public.crm_member_role[]
  ));