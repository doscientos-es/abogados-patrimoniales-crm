-- Preserve SECURITY INVOKER and RLS. Unaccent is stable, so these predicates
-- cannot use the existing lower()/trigram indexes; monitor as the dataset grows.
create extension if not exists unaccent with schema extensions;

create or replace function public.crm_global_search(target_firm_id uuid, search_term text)
returns table (id uuid, entity_type text, title text, subtitle text, href text, rank integer)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  normalized_term text := lower(extensions.unaccent(trim(coalesce(search_term, ''))));
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
  select * from (
    select c.id, 'contact'::text, c.display_name,
      concat_ws(' · ', c.reference, c.email, c.phone), '/contactos/' || c.id::text,
      case when lower(extensions.unaccent(c.reference)) = normalized_term then 100 else 80 end
    from public.crm_contacts c
    where c.firm_id = target_firm_id
      and lower(extensions.unaccent(c.reference || ' ' || c.display_name || ' ' || coalesce(c.email, '') || ' ' || coalesce(c.phone, '') || ' ' || coalesce(c.tax_id, ''))) like search_pattern escape E'\\'
    union all
    select o.id, 'opportunity'::text, o.title,
      concat_ws(' · ', o.reference, o.area, o.stage::text), '/oportunidades/' || o.id::text,
      case when lower(extensions.unaccent(o.reference)) = normalized_term then 100 else 78 end
    from public.crm_opportunities o
    where o.firm_id = target_firm_id and o.archived_at is null
      and lower(extensions.unaccent(o.reference || ' ' || o.title || ' ' || o.area || ' ' || o.description)) like search_pattern escape E'\\'
    union all
    select c.id, 'case'::text, c.title,
      concat_ws(' · ', c.reference, c.area, c.general_status), '/expedientes/' || c.id::text,
      case when lower(extensions.unaccent(c.reference)) = normalized_term then 100 else 76 end
    from public.crm_cases c
    where c.firm_id = target_firm_id
      and lower(extensions.unaccent(c.reference || ' ' || c.title || ' ' || c.area || ' ' || c.matter_type || ' ' || c.next_action)) like search_pattern escape E'\\'
    union all
    select t.id, 'task'::text, t.title,
      concat_ws(' · ', t.status::text, t.due_on::text, t.due_at::text), '/tareas', 70
    from public.crm_tasks t
    where t.firm_id = target_firm_id
      and lower(extensions.unaccent(t.title || ' ' || t.description)) like search_pattern escape E'\\'
    union all
    select d.id, 'document'::text, d.original_name,
      concat_ws(' · ', d.category, 'Expediente'), '/documentos?case=' || d.case_id::text, 72
    from public.crm_case_documents d
    where d.firm_id = target_firm_id and d.is_current and d.archived_at is null
      and lower(extensions.unaccent(d.original_name || ' ' || d.category)) like search_pattern escape E'\\'
    union all
    select n.id, 'note'::text, coalesce(n.title, 'Nota interna'),
      concat_ws(' · ', n.origin_label, n.status), '/notas', 65
    from public.crm_notes n
    where n.firm_id = target_firm_id and n.archived_at is null
      and lower(extensions.unaccent(coalesce(n.title, '') || ' ' || n.origin_label || ' ' || n.content)) like search_pattern escape E'\\'
    union all
    select i.id, 'invoice'::text, coalesce(nullif(i.concept, ''), i.reference),
      concat_ws(' · ', i.reference, i.recipient_name, i.status::text), '/facturacion',
      case when lower(extensions.unaccent(i.reference)) = normalized_term then 100 else 68 end
    from public.crm_invoices i
    where i.firm_id = target_firm_id
      and lower(extensions.unaccent(i.reference || ' ' || i.recipient_name || ' ' || i.concept)) like search_pattern escape E'\\'
    union all
    select o.id, 'onboarding'::text, o.matter_title,
      concat_ws(' · ', o.reference, o.phase::text, o.quote_reference), '/onboarding',
      case when lower(extensions.unaccent(o.reference)) = normalized_term then 100 else 74 end
    from public.crm_onboardings o
    where o.firm_id = target_firm_id
      and lower(extensions.unaccent(o.reference || ' ' || o.matter_title || ' ' || coalesce(o.quote_reference, '') || ' ' || o.next_action)) like search_pattern escape E'\\'
  ) results
  order by rank desc, title asc
  limit 30;
end;
$$;

notify pgrst, 'reload schema';