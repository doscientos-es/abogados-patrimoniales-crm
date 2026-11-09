-- A private bookmark, not a shared chat or an integration with OpenAI's API.
-- Lead RLS is evaluated by the EXISTS subquery, including active firm membership.
create table public.crm_lead_chatgpt_links (
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  user_id uuid not null references public.crm_profiles(id) on delete cascade,
  conversation_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (opportunity_id, user_id),
  constraint crm_lead_chatgpt_links_private_url check (
    char_length(conversation_url) <= 2048 and (
      conversation_url ~ '^https://(chatgpt[.]com|chat[.]openai[.]com)/(g/[a-zA-Z0-9_-]+/)?c/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      or conversation_url ~ '^chatgpt://(c|conversation)/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    )
  )
);

create index crm_lead_chatgpt_links_user_idx on public.crm_lead_chatgpt_links(user_id);
create trigger crm_lead_chatgpt_links_touch before update on public.crm_lead_chatgpt_links
  for each row execute function public.crm_touch_timestamp();

alter table public.crm_lead_chatgpt_links enable row level security;

create policy crm_lead_chatgpt_links_private on public.crm_lead_chatgpt_links
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.crm_opportunities o
      where o.id = crm_lead_chatgpt_links.opportunity_id
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.crm_opportunities o
      where o.id = crm_lead_chatgpt_links.opportunity_id
    )
  );

revoke all on public.crm_lead_chatgpt_links from public, anon, authenticated;
grant select, insert, delete on public.crm_lead_chatgpt_links to authenticated;
grant update (opportunity_id, user_id, conversation_url) on public.crm_lead_chatgpt_links to authenticated;