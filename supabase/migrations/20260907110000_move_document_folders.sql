-- Folder moves only change hierarchy metadata. A transaction-level case lock
-- serializes concurrent moves so two requests cannot create a parent cycle.
create or replace function public.crm_move_document_folder(
  target_folder_id uuid, target_parent_id uuid
)
returns public.crm_document_folders language plpgsql security definer set search_path = public as $$
declare
  source_folder public.crm_document_folders;
  destination_folder public.crm_document_folders;
begin
  if auth.uid() is null then raise exception 'Forbidden'; end if;

  select * into source_folder from public.crm_document_folders
  where id = target_folder_id for update;
  if not found or not public.crm_is_firm_member(source_folder.firm_id) then
    raise exception 'Folder not found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(source_folder.case_id::text, 0));
  if source_folder.parent_id is not distinct from target_parent_id then return source_folder; end if;
  if target_parent_id = source_folder.id then raise exception 'Folder cycle'; end if;

  if target_parent_id is not null then
    select * into destination_folder from public.crm_document_folders
    where id = target_parent_id for update;
    if not found or destination_folder.firm_id <> source_folder.firm_id
      or destination_folder.case_id <> source_folder.case_id then
      raise exception 'Folder not found';
    end if;
    if exists (
      with recursive descendants as (
        select id from public.crm_document_folders where parent_id = source_folder.id
        union all
        select child.id from public.crm_document_folders child
        join descendants parent on child.parent_id = parent.id
      ) select 1 from descendants where id = target_parent_id
    ) then raise exception 'Folder cycle'; end if;
  end if;

  update public.crm_document_folders set parent_id = target_parent_id
  where id = source_folder.id returning * into source_folder;
  return source_folder;
end;
$$;

revoke all on function public.crm_move_document_folder(uuid, uuid) from public, anon;
grant execute on function public.crm_move_document_folder(uuid, uuid) to authenticated;
notify pgrst, 'reload schema';