-- Composite indexes only cover foreign keys when their columns are the leftmost
-- prefix. Add the remaining single-column indexes required for referential work.
create index if not exists crm_ai_intake_documents_session_id_fk_idx
  on public.crm_ai_intake_documents (session_id);
create index if not exists crm_case_document_events_document_id_fk_idx
  on public.crm_case_document_events (document_id);
create index if not exists crm_case_documents_logical_document_id_fk_idx
  on public.crm_case_documents (logical_document_id);
create index if not exists crm_case_events_case_id_fk_idx
  on public.crm_case_events (case_id);
create index if not exists crm_document_folders_parent_id_fk_idx
  on public.crm_document_folders (parent_id);
create index if not exists crm_firm_members_user_id_fk_idx
  on public.crm_firm_members (user_id);
create index if not exists crm_note_acknowledgements_user_id_fk_idx
  on public.crm_note_acknowledgements (user_id);
create index if not exists crm_task_label_assignments_task_id_fk_idx
  on public.crm_task_label_assignments (task_id);