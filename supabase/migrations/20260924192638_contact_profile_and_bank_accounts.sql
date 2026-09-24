create table public.crm_contact_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete restrict,
  contact_id uuid not null,
  holder text not null check (char_length(trim(holder)) between 1 and 240),
  tax_id text not null default '',
  iban text not null check (char_length(regexp_replace(iban, '\s', '', 'g')) between 15 and 34),
  bank_name text not null default '',
  bic text not null default '',
  sepa_mandate boolean not null default false,
  sepa_signed_on date,
  mandate_status text not null default 'pending'
    check (mandate_status in ('current', 'pending', 'revoked', 'not_applicable')),
  observations text not null default '',
  valid_from date not null default current_date,
  valid_until date,
  created_by uuid not null default auth.uid() references public.crm_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (firm_id, id),
  foreign key (firm_id, contact_id) references public.crm_contacts(firm_id, id) on delete restrict,
  check (valid_until is null or valid_until >= valid_from)
);
create unique index crm_contact_bank_accounts_one_active_idx
  on public.crm_contact_bank_accounts (firm_id, contact_id) where valid_until is null;
create index crm_contact_bank_accounts_history_idx
  on public.crm_contact_bank_accounts (firm_id, contact_id, valid_from desc);
alter table public.crm_contact_bank_accounts enable row level security;
create policy crm_contact_bank_accounts_privileged_select
  on public.crm_contact_bank_accounts for select to authenticated
  using (exists (
    select 1 from public.crm_firm_members m
    where m.firm_id = crm_contact_bank_accounts.firm_id
      and m.user_id = (select auth.uid()) and m.status = 'active'
      and m.role in ('owner', 'admin', 'lawyer')
  ));
grant select on public.crm_contact_bank_accounts to authenticated;

create or replace function public.crm_replace_contact_bank_account(
  target_firm_id uuid, target_contact_id uuid, bank_data jsonb
)
returns public.crm_contact_bank_accounts
language plpgsql security definer set search_path = public as $$
declare result public.crm_contact_bank_accounts; current_contact public.crm_contacts;
  clean_iban text; mandate text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.crm_firm_members m
    where m.firm_id = target_firm_id and m.user_id = auth.uid()
      and m.status = 'active' and m.role in ('owner', 'admin', 'lawyer')
  ) then raise exception 'Forbidden' using errcode = '42501'; end if;
  select * into current_contact from public.crm_contacts
    where id = target_contact_id and firm_id = target_firm_id for update;
  if not found then raise exception 'Contact not found'; end if;
  if jsonb_typeof(bank_data) <> 'object' then raise exception 'Invalid bank data'; end if;
  clean_iban := upper(regexp_replace(coalesce(bank_data->>'iban', ''), '\s', '', 'g'));
  mandate := coalesce(bank_data->>'mandate_status', 'pending');
  if length(clean_iban) < 15 or length(clean_iban) > 34 then raise exception 'IBAN is invalid'; end if;
  if mandate not in ('current', 'pending', 'revoked', 'not_applicable') then raise exception 'Invalid mandate status'; end if;
  update public.crm_contact_bank_accounts set valid_until = current_date
    where firm_id = target_firm_id and contact_id = target_contact_id and valid_until is null;
  insert into public.crm_contact_bank_accounts (
    firm_id, contact_id, holder, tax_id, iban, bank_name, bic, sepa_mandate,
    sepa_signed_on, mandate_status, observations, created_by
  ) values (
    target_firm_id, target_contact_id, trim(coalesce(bank_data->>'holder', '')),
    coalesce(bank_data->>'tax_id', ''), clean_iban, coalesce(bank_data->>'bank_name', ''),
    upper(coalesce(bank_data->>'bic', '')), coalesce((bank_data->>'sepa_mandate')::boolean, false),
    nullif(bank_data->>'sepa_signed_on', '')::date, mandate,
    coalesce(bank_data->>'observations', ''), auth.uid()
  ) returning * into result;
  return result;
end;
$$;
revoke all on function public.crm_replace_contact_bank_account(uuid, uuid, jsonb) from public, anon;
grant execute on function public.crm_replace_contact_bank_account(uuid, uuid, jsonb) to authenticated;

create or replace function public.crm_update_contact_profile(
  target_contact_id uuid, target_expected_version integer, new_profile jsonb
)
returns public.crm_contacts
language plpgsql security definer set search_path = public as $$
declare result public.crm_contacts;
begin
  if auth.uid() is null or jsonb_typeof(new_profile) <> 'object' then
    raise exception 'Invalid profile update';
  end if;
  update public.crm_contacts c
    set details = coalesce(c.details, '{}'::jsonb) || jsonb_build_object('profile', new_profile),
        version = c.version + 1
    where c.id = target_contact_id and c.version = target_expected_version
      and public.crm_is_firm_member(c.firm_id)
    returning c.* into result;
  if not found then
    raise exception 'Contact changed or unavailable; reload before saving' using errcode = '40001';
  end if;
  return result;
end;
$$;
revoke all on function public.crm_update_contact_profile(uuid, integer, jsonb) from public, anon;
grant execute on function public.crm_update_contact_profile(uuid, integer, jsonb) to authenticated;

alter table public.crm_contact_documents drop constraint crm_contact_documents_document_type_check;
alter table public.crm_contact_documents add constraint crm_contact_documents_document_type_check
  check (document_type in ('identification', 'privacy', 'authority', 'power', 'other'));
alter table public.crm_contact_documents
  add column document_status text not null default 'current'
    check (document_status in ('current', 'pending', 'expiring', 'expired', 'revoked', 'not_applicable')),
  add column document_number text not null default '',
  add column issued_on date,
  add column expires_on date,
  add column signed_on date,
  add column observations text not null default '',
  add column tags text[] not null default '{}';

drop policy crm_contact_documents_select on public.crm_contact_documents;
drop policy crm_contact_documents_insert on public.crm_contact_documents;
create policy crm_contact_documents_select on public.crm_contact_documents for select to authenticated
  using (exists (
    select 1 from public.crm_firm_members m where m.firm_id = crm_contact_documents.firm_id
      and m.user_id = (select auth.uid()) and m.status = 'active'
      and m.role in ('owner', 'admin', 'lawyer')
  ));
create policy crm_contact_documents_insert on public.crm_contact_documents for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.crm_firm_members m where m.firm_id = crm_contact_documents.firm_id
        and m.user_id = (select auth.uid()) and m.status = 'active'
        and m.role in ('owner', 'admin', 'lawyer')
    )
    and exists (
      select 1 from public.crm_contacts c where c.id = contact_id and c.firm_id = crm_contact_documents.firm_id
    )
  );
drop policy crm_contact_documents_storage_select on storage.objects;
drop policy crm_contact_documents_storage_insert on storage.objects;
create policy crm_contact_documents_storage_select on storage.objects for select to authenticated using (
  bucket_id = 'contact-documents' and exists (
    select 1 from public.crm_contact_documents d
    join public.crm_firm_members m on m.firm_id = d.firm_id
    where d.storage_path = name and m.user_id = (select auth.uid()) and m.status = 'active'
      and m.role in ('owner', 'admin', 'lawyer')
  )
);
create policy crm_contact_documents_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'contact-documents' and array_length(storage.foldername(name), 1) = 3
  and exists (
    select 1 from public.crm_contacts c
    join public.crm_firm_members m on m.firm_id = c.firm_id
    where c.firm_id::text = (storage.foldername(name))[1]
      and c.id::text = (storage.foldername(name))[2]
      and m.user_id = (select auth.uid()) and m.status = 'active'
      and m.role in ('owner', 'admin', 'lawyer')
  )
);
notify pgrst, 'reload schema';
