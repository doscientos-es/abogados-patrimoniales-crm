-- Covers the folder foreign key for folder deletion checks; the partial index
-- in the preceding migration remains optimized for the document explorer.
create index crm_case_documents_folder_fk_idx on public.crm_case_documents(folder_id);