-- This routine is invoked exclusively by the auth.users confirmation trigger.
-- It must not be exposed as a PostgREST RPC.
revoke all on function public.crm_activate_invited_member() from public, anon, authenticated;