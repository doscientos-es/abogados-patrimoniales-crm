create or replace function public.crm_reorder_case_workstreams(
  target_case_id uuid,
  ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  case_firm_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if ordered_ids is null or cardinality(ordered_ids) = 0 then
    raise exception 'A workstream order is required';
  end if;

  select firm_id into case_firm_id from public.crm_cases where id = target_case_id;
  if not found then raise exception 'Case not found'; end if;
  if not public.crm_is_firm_member(case_firm_id) then raise exception 'Forbidden'; end if;

  update public.crm_case_workstreams workstream
  set sort_order = ordering.position
  from (
    select item.id, item.position::integer as position
    from unnest(ordered_ids) with ordinality as item(id, position)
  ) ordering
  where workstream.id = ordering.id
    and workstream.case_id = target_case_id
    and workstream.firm_id = case_firm_id
    and workstream.sort_order <> ordering.position;
end;
$$;

revoke all on function public.crm_reorder_case_workstreams(uuid, uuid[]) from public, anon;
grant execute on function public.crm_reorder_case_workstreams(uuid, uuid[]) to authenticated;
