-- Keep RLS predicates sargable by evaluating the authenticated identity once.
drop policy "crm_case_document_events_read" on public.crm_case_document_events;
create policy "crm_case_document_events_read" on public.crm_case_document_events
  for select to authenticated using (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_case_document_events.firm_id
        and m.user_id = (select auth.uid()) and m.status = 'active'
        and m.role in ('owner', 'admin'))
  );

drop policy "crm task labels members read" on public.crm_task_labels;
drop policy "crm task labels admins manage" on public.crm_task_labels;
create policy "crm task labels members read" on public.crm_task_labels
  for select to authenticated using (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_task_labels.firm_id
        and m.user_id = (select auth.uid()) and m.status = 'active')
  );
create policy "crm task labels admins insert" on public.crm_task_labels
  for insert to authenticated with check (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_task_labels.firm_id
        and m.user_id = (select auth.uid()) and m.status = 'active'
        and m.role in ('owner', 'admin', 'lawyer'))
  );
create policy "crm task labels admins update" on public.crm_task_labels
  for update to authenticated using (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_task_labels.firm_id
        and m.user_id = (select auth.uid()) and m.status = 'active'
        and m.role in ('owner', 'admin', 'lawyer'))
  ) with check (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_task_labels.firm_id
        and m.user_id = (select auth.uid()) and m.status = 'active'
        and m.role in ('owner', 'admin', 'lawyer'))
  );
create policy "crm task labels admins delete" on public.crm_task_labels
  for delete to authenticated using (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_task_labels.firm_id
        and m.user_id = (select auth.uid()) and m.status = 'active'
        and m.role in ('owner', 'admin', 'lawyer'))
  );

drop policy "crm label assignments members read" on public.crm_task_label_assignments;
drop policy "crm label assignments members manage" on public.crm_task_label_assignments;
create policy "crm label assignments members manage" on public.crm_task_label_assignments
  for all to authenticated using (
    exists (select 1 from public.crm_task_labels l
      join public.crm_firm_members m on m.firm_id = l.firm_id
      where l.id = label_id and m.user_id = (select auth.uid()) and m.status = 'active')
  ) with check (
    exists (select 1 from public.crm_task_labels l
      join public.crm_firm_members m on m.firm_id = l.firm_id
      where l.id = label_id and m.user_id = (select auth.uid()) and m.status = 'active')
  );

drop policy "crm title templates members read" on public.crm_task_title_templates;
drop policy "crm title templates admins manage" on public.crm_task_title_templates;
create policy "crm title templates members read" on public.crm_task_title_templates
  for select to authenticated using (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_task_title_templates.firm_id
        and m.user_id = (select auth.uid()) and m.status = 'active')
  );
create policy "crm title templates admins insert" on public.crm_task_title_templates
  for insert to authenticated with check (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_task_title_templates.firm_id
        and m.user_id = (select auth.uid()) and m.status = 'active'
        and m.role in ('owner', 'admin', 'lawyer'))
  );
create policy "crm title templates admins update" on public.crm_task_title_templates
  for update to authenticated using (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_task_title_templates.firm_id
        and m.user_id = (select auth.uid()) and m.status = 'active'
        and m.role in ('owner', 'admin', 'lawyer'))
  ) with check (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_task_title_templates.firm_id
        and m.user_id = (select auth.uid()) and m.status = 'active'
        and m.role in ('owner', 'admin', 'lawyer'))
  );
create policy "crm title templates admins delete" on public.crm_task_title_templates
  for delete to authenticated using (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_task_title_templates.firm_id
        and m.user_id = (select auth.uid()) and m.status = 'active'
        and m.role in ('owner', 'admin', 'lawyer'))
  );

drop policy "crm practice areas members read" on public.crm_practice_areas;
drop policy "crm practice areas admins manage" on public.crm_practice_areas;
create policy "crm practice areas members read" on public.crm_practice_areas
  for select to authenticated using (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_practice_areas.firm_id
        and m.user_id = (select auth.uid()) and m.status = 'active')
  );
create policy "crm practice areas admins insert" on public.crm_practice_areas
  for insert to authenticated with check (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_practice_areas.firm_id
        and m.user_id = (select auth.uid()) and m.status = 'active'
        and m.role in ('owner', 'admin', 'lawyer'))
  );
create policy "crm practice areas admins update" on public.crm_practice_areas
  for update to authenticated using (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_practice_areas.firm_id
        and m.user_id = (select auth.uid()) and m.status = 'active'
        and m.role in ('owner', 'admin', 'lawyer'))
  ) with check (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_practice_areas.firm_id
        and m.user_id = (select auth.uid()) and m.status = 'active'
        and m.role in ('owner', 'admin', 'lawyer'))
  );
create policy "crm practice areas admins delete" on public.crm_practice_areas
  for delete to authenticated using (
    exists (select 1 from public.crm_firm_members m
      where m.firm_id = crm_practice_areas.firm_id
        and m.user_id = (select auth.uid()) and m.status = 'active'
        and m.role in ('owner', 'admin', 'lawyer'))
  );

-- Extension objects are not part of the exposed API schema.
create schema if not exists extensions;
alter extension pg_trgm set schema extensions;

-- Cover every current foreign key on the referencing side. The data set is still
-- small, so regular index creation avoids a long future maintenance window.
do $$
declare
  foreign_key record;
begin
  for foreign_key in
    select
      n.nspname as schema_name,
      c.relname as table_name,
      array_agg(a.attname order by key.ordinality) as column_names
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral unnest(con.conkey) with ordinality as key(attnum, ordinality)
    join pg_attribute a on a.attrelid = c.oid and a.attnum = key.attnum
    where con.contype = 'f'
      and n.nspname = 'public'
      and not exists (
        select 1 from pg_index i
        where i.indrelid = con.conrelid and i.indisvalid and i.indpred is null
          and i.indkey::smallint[] @> con.conkey
      )
    group by n.nspname, c.relname, con.conname, con.conkey
  loop
    execute format(
      'create index if not exists %I on %I.%I (%s)',
      left(foreign_key.table_name || '_' || array_to_string(foreign_key.column_names, '_') || '_fk_idx', 63),
      foreign_key.schema_name,
      foreign_key.table_name,
      array_to_string(array(select format('%I', column_name) from unnest(foreign_key.column_names) column_name), ', ')
    );
  end loop;
end;
$$;