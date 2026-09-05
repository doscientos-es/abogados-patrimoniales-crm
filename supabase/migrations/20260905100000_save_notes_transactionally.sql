-- A note and its private links form one aggregate. Saving them in a SECURITY
-- DEFINER RPC avoids partial writes from the browser while keeping all access
-- checks scoped to the authenticated member and the target firm.
create or replace function public.crm_save_note(
  target_firm_id uuid,
  target_note_id uuid,
  target_payload jsonb,
  event_type text,
  event_detail text default null
)
returns public.crm_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.crm_notes;
begin
  if auth.uid() is null or not public.crm_is_firm_member(target_firm_id) then
    raise exception 'You are not an active member of this firm';
  end if;

  if target_note_id is null then
    insert into public.crm_notes (
      firm_id, scope, origin_id, origin_label, title, content, case_id, opportunity_id,
      status, highlighted, critical, requires_acknowledgement, validity, starts_on,
      review_on, expires_on, expiry_action, review_pending, snoozed_until, visibility,
      details, created_by, updated_by
    ) values (
      target_firm_id, target_payload->>'scope', (target_payload->>'origin_id')::uuid,
      target_payload->>'origin_label', nullif(target_payload->>'title', ''), target_payload->>'content',
      nullif(target_payload->>'case_id', '')::uuid, nullif(target_payload->>'opportunity_id', '')::uuid,
      target_payload->>'status', coalesce((target_payload->>'highlighted')::boolean, false),
      coalesce((target_payload->>'critical')::boolean, false),
      coalesce((target_payload->>'requires_acknowledgement')::boolean, false), target_payload->>'validity',
      nullif(target_payload->>'starts_on', '')::date, nullif(target_payload->>'review_on', '')::date,
      nullif(target_payload->>'expires_on', '')::date, target_payload->>'expiry_action',
      coalesce((target_payload->>'review_pending')::boolean, false),
      nullif(target_payload->>'snoozed_until', '')::date, target_payload->>'visibility',
      coalesce(target_payload->'details', '{}'::jsonb), auth.uid(), auth.uid()
    ) returning * into saved;
  else
    select * into saved from public.crm_notes where id = target_note_id and firm_id = target_firm_id for update;
    if not found then raise exception 'Note not found'; end if;
    if saved.created_by <> auth.uid()
      and not public.crm_has_firm_role(target_firm_id, array['owner', 'admin']::public.crm_member_role[]) then
      raise exception 'You cannot modify this note';
    end if;
    update public.crm_notes set
      scope = target_payload->>'scope', origin_id = (target_payload->>'origin_id')::uuid,
      origin_label = target_payload->>'origin_label', title = nullif(target_payload->>'title', ''),
      content = target_payload->>'content', case_id = nullif(target_payload->>'case_id', '')::uuid,
      opportunity_id = nullif(target_payload->>'opportunity_id', '')::uuid, status = target_payload->>'status',
      highlighted = coalesce((target_payload->>'highlighted')::boolean, false),
      critical = coalesce((target_payload->>'critical')::boolean, false),
      requires_acknowledgement = coalesce((target_payload->>'requires_acknowledgement')::boolean, false),
      validity = target_payload->>'validity', starts_on = nullif(target_payload->>'starts_on', '')::date,
      review_on = nullif(target_payload->>'review_on', '')::date, expires_on = nullif(target_payload->>'expires_on', '')::date,
      expiry_action = target_payload->>'expiry_action', review_pending = coalesce((target_payload->>'review_pending')::boolean, false),
      snoozed_until = nullif(target_payload->>'snoozed_until', '')::date, visibility = target_payload->>'visibility',
      details = coalesce(target_payload->'details', '{}'::jsonb), updated_by = auth.uid(),
      resolved_by = case when target_payload->>'status' = 'resolved' then auth.uid() else null end,
      resolved_at = case when target_payload->>'status' = 'resolved' then now() else null end,
      archived_by = case when target_payload->>'status' = 'archived' then auth.uid() else null end,
      archived_at = case when target_payload->>'status' = 'archived' then now() else null end
    where id = target_note_id and firm_id = target_firm_id
    returning * into saved;
  end if;

  delete from public.crm_note_contacts where note_id = saved.id and firm_id = target_firm_id;
  insert into public.crm_note_contacts(note_id, firm_id, contact_id)
  select saved.id, target_firm_id, value::uuid
  from jsonb_array_elements_text(coalesce(target_payload->'contact_ids', '[]'::jsonb));

  delete from public.crm_note_permissions where note_id = saved.id and firm_id = target_firm_id;
  insert into public.crm_note_permissions(note_id, firm_id, user_id)
  select saved.id, target_firm_id, value::uuid
  from jsonb_array_elements_text(coalesce(target_payload->'permitted_user_ids', '[]'::jsonb));

  insert into public.crm_note_events(note_id, firm_id, event_type, detail)
  values (saved.id, target_firm_id, event_type, event_detail);
  return saved;
end;
$$;

revoke all on function public.crm_save_note(uuid, uuid, jsonb, text, text) from public, anon;
grant execute on function public.crm_save_note(uuid, uuid, jsonb, text, text) to authenticated;

create or replace function public.crm_acknowledge_note(target_note_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.crm_note_acknowledgements(note_id, user_id)
  values (target_note_id, auth.uid())
  on conflict (note_id, user_id) do nothing;
end;
$$;

revoke all on function public.crm_acknowledge_note(uuid) from public, anon;
grant execute on function public.crm_acknowledge_note(uuid) to authenticated;
