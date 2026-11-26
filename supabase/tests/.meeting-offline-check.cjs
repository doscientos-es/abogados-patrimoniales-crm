const fs = require('node:fs')
const path = require('node:path')
const { PGlite } = require(path.join(process.cwd(), 'node_modules/@electric-sql/pglite'))

async function main() {
  const db = new PGlite()
  try {
    await db.exec(`
      create schema auth;
      create role anon; create role authenticated;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table auth.users(id uuid primary key, email text);
      create table public.crm_profiles(id uuid primary key, display_name text default 'Test');
      create function public.test_create_profile() returns trigger language plpgsql as
        $$ begin insert into public.crm_profiles(id) values (new.id); return new; end $$;
      create trigger test_create_profile after insert on auth.users for each row execute function public.test_create_profile();
      create table public.crm_firms(id uuid primary key, name text);
      create table public.crm_firm_members(firm_id uuid, user_id uuid, role text, status text);
      create table public.crm_contacts(id uuid primary key, firm_id uuid, nature text, relationship text, display_name text);
      create table public.crm_opportunities(id uuid primary key, firm_id uuid, contact_id uuid, title text);
      create table public.crm_tasks(id uuid primary key, firm_id uuid, opportunity_id uuid, kind text,
        title text, assigned_to uuid, meeting_details jsonb default '{}', created_by uuid default auth.uid());
      create table public.crm_task_messages(id uuid primary key default gen_random_uuid(), firm_id uuid,
        task_id uuid, author_id uuid, body text, message_type text);
      create table public.crm_notifications(id uuid primary key default gen_random_uuid(), firm_id uuid,
        recipient_id uuid, actor_id uuid, actor_name text default '', task_id uuid, task_title text,
        message_id uuid, kind text, body text, created_at timestamptz default now());
    `)
    const read = (relative) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8')
    const messageSql = read('migrations/20260928093000_task_message_notifications.sql')
    await db.exec(messageSql.slice(messageSql.indexOf('create or replace function public.crm_notify_task_message()'), messageSql.indexOf('create or replace function public.crm_mark_notifications_read')))
    const assignmentSql = read('migrations/20261013143515_task_assignment_notifications_and_waiting_history.sql')
    await db.exec(assignmentSql.split('-- Extend the existing waiting event')[0])
    await db.exec(read('migrations/20261126150000_self_assigned_meeting_notification.sql'))
    await db.exec(read('tests/self_assigned_meeting_notification_regression.sql'))
    console.log('Offline PostgreSQL meeting notification regression: passed')
  } finally {
    await db.close()
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })