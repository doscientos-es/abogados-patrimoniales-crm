-- Persisted firm settings, editable only by firm owners and administrators.
create table public.crm_firm_settings (
  firm_id uuid primary key references public.crm_firms(id) on delete restrict,
  legal_name text not null default '' check (char_length(trim(legal_name)) <= 240),
  tax_id text not null default '' check (char_length(trim(tax_id)) <= 40),
  address text not null default '' check (char_length(trim(address)) <= 500),
  professional_registration text not null default '' check (char_length(trim(professional_registration)) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_firm_settings enable row level security;

create policy crm_firm_settings_select on public.crm_firm_settings
  for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_firm_settings_insert on public.crm_firm_settings
  for insert to authenticated
  with check (public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]));
create policy crm_firm_settings_update on public.crm_firm_settings
  for update to authenticated
  using (public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]))
  with check (public.crm_has_firm_role(firm_id, array['owner', 'admin']::public.crm_member_role[]));

create or replace function public.crm_save_firm_settings(
  target_firm_id uuid,
  new_firm_name text,
  new_legal_name text,
  new_tax_id text,
  new_address text,
  new_professional_registration text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null
    or not public.crm_has_firm_role(target_firm_id, array['owner', 'admin']::public.crm_member_role[]) then
    raise exception 'Only firm owners and administrators can update firm settings';
  end if;

  if char_length(trim(coalesce(new_firm_name, ''))) not between 2 and 160 then
    raise exception 'Firm name must contain between 2 and 160 characters';
  end if;

  update public.crm_firms
  set name = trim(new_firm_name), updated_at = now()
  where id = target_firm_id;

  if not found then
    raise exception 'Firm not found';
  end if;

  insert into public.crm_firm_settings (
    firm_id, legal_name, tax_id, address, professional_registration
  ) values (
    target_firm_id,
    trim(coalesce(new_legal_name, '')),
    trim(coalesce(new_tax_id, '')),
    trim(coalesce(new_address, '')),
    trim(coalesce(new_professional_registration, ''))
  )
  on conflict (firm_id) do update set
    legal_name = excluded.legal_name,
    tax_id = excluded.tax_id,
    address = excluded.address,
    professional_registration = excluded.professional_registration,
    updated_at = now();
end;
$$;

revoke all on function public.crm_save_firm_settings(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.crm_save_firm_settings(uuid, text, text, text, text, text) to authenticated;
grant select, insert, update on public.crm_firm_settings to authenticated;