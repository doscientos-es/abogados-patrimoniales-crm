-- Document metadata must be created and changed through the scoped RPCs only.
-- Direct writes could otherwise reference a private object with forged metadata.
drop policy if exists crm_case_documents_create on public.crm_case_documents;
drop policy if exists crm_case_documents_update on public.crm_case_documents;