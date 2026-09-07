-- Contacts may be permanently deleted only by members of their own firm.
-- Referential constraints preserve records that are already operationally linked.
create policy crm_contacts_delete on public.crm_contacts
for delete to authenticated
using (public.crm_is_firm_member(firm_id));