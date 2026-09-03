-- crm_case_documents.version is its immutable logical-version sequence, not
-- an optimistic-lock counter. Finalizing content must not skip a version.
create or replace function public.crm_touch_case_document()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists crm_case_documents_touch on public.crm_case_documents;
create trigger crm_case_documents_touch
  before update on public.crm_case_documents
  for each row execute procedure public.crm_touch_case_document();