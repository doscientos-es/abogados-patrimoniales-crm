create or replace function public.crm_set_default_quote_template(target_template_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare target_firm uuid;
begin
  select firm_id into target_firm from public.crm_quote_email_templates
    where id = target_template_id and active;
  if target_firm is null then raise exception 'Active quote template not found'; end if;
  if not exists (
    select 1 from public.crm_firm_members m where m.firm_id = target_firm
      and m.user_id = (select auth.uid()) and m.status = 'active'
      and m.role in ('owner', 'admin', 'lawyer')
  ) then raise exception 'Forbidden'; end if;

  -- Lock the firm’s template rows in a stable order to serialize default changes.
  -- Locking crm_firms would conflict with its owner/admin-only update policy for lawyers.
  perform 1 from public.crm_quote_email_templates
    where firm_id = target_firm order by id for update;
  update public.crm_quote_email_templates set is_default = false
    where firm_id = target_firm and is_default;
  update public.crm_quote_email_templates set is_default = true
    where id = target_template_id and firm_id = target_firm and active;
end;
$$;
notify pgrst, 'reload schema';
