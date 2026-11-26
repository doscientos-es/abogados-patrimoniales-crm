const fs = require('node:fs')
const path = require('node:path')
const { PGlite } = require(path.join(process.cwd(), 'node_modules/@electric-sql/pglite'))

async function main() {
  console.log('Preparing local database')
  const db = new PGlite()
  const statements = [
    'create schema auth',
    'create role anon',
    'create role authenticated',
    'create role service_role',
    "create type public.crm_member_role as enum ('owner','admin','lawyer','paralegal')",
    "create type public.crm_member_status as enum ('active','disabled','invited')",
    "create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid'",
    'create table auth.users (id uuid primary key, aud text, role text, email text, email_confirmed_at timestamptz, deleted_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz)',
    'create table public.crm_profiles (id uuid primary key references auth.users(id))',
    'create function public.create_test_profile() returns trigger language plpgsql as $$begin insert into public.crm_profiles values (new.id); return new; end$$',
    'create trigger test_profile after insert on auth.users for each row execute function public.create_test_profile()',
    'create table public.crm_firms (id uuid primary key, name text)',
    'create table public.crm_firm_members (firm_id uuid references public.crm_firms(id), user_id uuid references public.crm_profiles(id), role public.crm_member_role, status public.crm_member_status, primary key(firm_id,user_id))',
    'create function public.crm_delete_firm_member(uuid,uuid) returns integer language sql as $$ select 0 $$',
    'grant execute on function public.crm_delete_firm_member(uuid,uuid) to authenticated',
  ]
  for (const name of [
    'crm_opportunities',
    'crm_tasks',
    'crm_cases',
    'crm_case_tasks',
    'crm_case_workstreams',
    'crm_case_dates',
    'crm_case_communications',
    'crm_case_documents',
    'crm_onboardings',
  ])
    statements.push('create table public.' + name + ' (firm_id uuid, assigned_to uuid)')
  await db.exec(statements.join(';'))
  console.log('Applying migration')
  await db.exec(
    fs.readFileSync(
      path.join(__dirname, '../migrations/20261126140000_team_member_removal.sql'),
      'utf8',
    ),
  )
  console.log('Running contract')
  await db.exec(fs.readFileSync(path.join(__dirname, 'team_member_removal_contract.sql'), 'utf8'))
  console.log('Offline PostgreSQL-compatible membership contract: passed')
  await db.close()
}
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
