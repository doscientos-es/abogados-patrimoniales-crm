-- Bounded, tenant-scoped lookup for the command palette. SECURITY INVOKER keeps RLS,
-- including restricted notes and document visibility, in effect for every source table.
create extension if not exists pg_trgm;

create index if not exists crm_contacts_global_search_idx
  on public.crm_contacts using gin ((lower(reference || ' ' || display_name || ' ' || coalesce(email, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(tax_id, ''))) gin_trgm_ops);
create index if not exists crm_opportunities_global_search_idx
  on public.crm_opportunities using gin ((lower(reference || ' ' || title || ' ' || area || ' ' || description)) gin_trgm_ops)
  where archived_at is null;
create index if not exists crm_cases_global_search_idx
  on public.crm_cases using gin ((lower(reference || ' ' || title || ' ' || area || ' ' || matter_type || ' ' || next_action)) gin_trgm_ops);
create index if not exists crm_tasks_global_search_idx
  on public.crm_tasks using gin ((lower(title || ' ' || description)) gin_trgm_ops);
create index if not exists crm_case_documents_global_search_idx
  on public.crm_case_documents using gin ((lower(original_name || ' ' || category)) gin_trgm_ops)
  where is_current and archived_at is null;
create index if not exists crm_notes_global_search_idx
  on public.crm_notes using gin ((lower(coalesce(title, '') || ' ' || origin_label || ' ' || content)) gin_trgm_ops)
  where archived_at is null;
create index if not exists crm_invoices_global_search_idx
  on public.crm_invoices using gin ((lower(reference || ' ' || recipient_name || ' ' || concept)) gin_trgm_ops);
create index if not exists crm_onboardings_global_search_idx
  on public.crm_onboardings using gin ((lower(reference || ' ' || matter_title || ' ' || coalesce(quote_reference, '') || ' ' || next_action)) gin_trgm_ops);

create or replace function public.crm_global_search(target_firm_id uuid, search_term text)
returns table (
  id uuid,
  entity_type text,
  title text,
  subtitle text,
  href text,
  rank integer
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  normalized_term text := lower(trim(coalesce(search_term, '')));
  search_pattern text;
begin
  if auth.uid() is null or not public.crm_is_firm_member(target_firm_id) then
    raise exception 'Forbidden';
  end if;
  if char_length(normalized_term) < 2 or char_length(normalized_term) > 120 then
    raise exception 'Search terms must be between 2 and 120 characters';
  end if;

  search_pattern := '%' || replace(replace(replace(normalized_term, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';

  return query
  select *
  from (
    select c.id, 'contact'::text, c.display_name,
      concat_ws(' · ', c.reference, c.email, c.phone),
      '/contactos/' || c.id::text,
      case when lower(c.reference) = normalized_term then 100 else 80 end
    from public.crm_contacts c
    where c.firm_id = target_firm_id
      and lower(c.reference || ' ' || c.display_name || ' ' || coalesce(c.email, '') || ' ' || coalesce(c.phone, '') || ' ' || coalesce(c.tax_id, '')) ilike search_pattern escape E'\\'

    union all
    select o.id, 'opportunity'::text, o.title,
      concat_ws(' · ', o.reference, o.area, o.stage::text),
      '/oportunidades/' || o.id::text,
      case when lower(o.reference) = normalized_term then 100 else 78 end
    from public.crm_opportunities o
    where o.firm_id = target_firm_id and o.archived_at is null
      and lower(o.reference || ' ' || o.title || ' ' || o.area || ' ' || o.description) ilike search_pattern escape E'\\'

    union all
    select c.id, 'case'::text, c.title,
      concat_ws(' · ', c.reference, c.area, c.general_status),
      '/expedientes/' || c.id::text,
      case when lower(c.reference) = normalized_term then 100 else 76 end
    from public.crm_cases c
    where c.firm_id = target_firm_id
      and lower(c.reference || ' ' || c.title || ' ' || c.area || ' ' || c.matter_type || ' ' || c.next_action) ilike search_pattern escape E'\\'

    union all
    select t.id, 'task'::text, t.title,
      concat_ws(' · ', t.status::text, t.due_on::text, t.due_at::text),
      '/tareas', 70
    from public.crm_tasks t
    where t.firm_id = target_firm_id
      and lower(t.title || ' ' || t.description) ilike search_pattern escape E'\\'

    union all
    select d.id, 'document'::text, d.original_name,
      concat_ws(' · ', d.category, 'Expediente'),
      '/documentos?case=' || d.case_id::text, 72
    from public.crm_case_documents d
    where d.firm_id = target_firm_id and d.is_current and d.archived_at is null
      and lower(d.original_name || ' ' || d.category) ilike search_pattern escape E'\\'

    union all
    select n.id, 'note'::text, coalesce(n.title, 'Nota interna'),
      concat_ws(' · ', n.origin_label, n.status),
      '/notas', 65
    from public.crm_notes n
    where n.firm_id = target_firm_id and n.archived_at is null
      and lower(coalesce(n.title, '') || ' ' || n.origin_label || ' ' || n.content) ilike search_pattern escape E'\\'

    union all
    select i.id, 'invoice'::text, coalesce(nullif(i.concept, ''), i.reference),
      concat_ws(' · ', i.reference, i.recipient_name, i.status::text),
      '/facturacion',
      case when lower(i.reference) = normalized_term then 100 else 68 end
    from public.crm_invoices i
    where i.firm_id = target_firm_id
      and lower(i.reference || ' ' || i.recipient_name || ' ' || i.concept) ilike search_pattern escape E'\\'

    union all
    select o.id, 'onboarding'::text, o.matter_title,
      concat_ws(' · ', o.reference, o.phase::text, o.quote_reference),
      '/onboarding',
      case when lower(o.reference) = normalized_term then 100 else 74 end
    from public.crm_onboardings o
    where o.firm_id = target_firm_id
      and lower(o.reference || ' ' || o.matter_title || ' ' || coalesce(o.quote_reference, '') || ' ' || o.next_action) ilike search_pattern escape E'\\'
  ) results
  order by rank desc, title asc
  limit 30;
end;
$$;

revoke all on function public.crm_global_search(uuid, text) from public, anon;
grant execute on function public.crm_global_search(uuid, text) to authenticated;