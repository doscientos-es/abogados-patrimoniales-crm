-- Keep the published client working until the frontend uses delete-disabled-firm-member.
grant execute on function public.crm_delete_firm_member(uuid, uuid) to authenticated;