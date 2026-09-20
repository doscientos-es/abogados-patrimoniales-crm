-- PostgreSQL requires this enum value to commit before a later migration can
-- use it in constraints, functions, or indexes.
alter type public.crm_task_status add value if not exists 'waiting';