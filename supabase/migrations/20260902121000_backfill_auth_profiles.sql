-- The auth trigger only handles future users. Backfill users created before
-- the CRM core migration so they can create or receive a firm membership.
insert into public.crm_profiles (id, display_name)
select id, coalesce(raw_user_meta_data ->> 'display_name', '')
from auth.users
on conflict (id) do nothing;