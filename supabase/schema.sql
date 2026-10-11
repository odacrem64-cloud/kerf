-- =====================================================================
-- Kerf database setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run again later: it only adds what's missing.
-- =====================================================================

-- ---------- Who can sign in, and what they can do ----------
-- access: 'admin' = owner/office (everything), 'staff' = sales (no price list or team changes),
--         'crew' = templaters, fabricators, installers (their schedule, notes, marking work done)
create table if not exists public.members (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  team_id    text,
  access     text not null default 'crew' check (access in ('admin', 'staff', 'crew')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.members enable row level security;

create or replace function public.kerf_access() returns text
language sql stable security definer set search_path = public as $$
  select access from public.members where user_id = auth.uid() and active
$$;
create or replace function public.kerf_is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and active)
$$;
create or replace function public.kerf_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and active and access in ('admin', 'staff'))
$$;
create or replace function public.kerf_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and active and access = 'admin')
$$;

-- ---------- Shop data: one JSON document per row ----------
do $$
declare t text;
begin
  foreach t in array array['jobs', 'activities', 'customers', 'team', 'notes', 'settings'] loop
    execute format(
      'create table if not exists public.%I (
         id         text primary key,
         data       jsonb not null default ''{}''::jsonb,
         updated_at timestamptz not null default now(),
         updated_by uuid default auth.uid()
       )', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- notes are looked up by job and by time
alter table public.notes add column if not exists job_id text generated always as (data ->> 'jobId') stored;
alter table public.notes add column if not exists at bigint generated always as (floor(coalesce(nullif(data ->> 'at', ''), '0')::numeric)::bigint) stored;
create index if not exists notes_job_idx on public.notes (job_id);
create index if not exists notes_at_idx on public.notes (at desc);
create index if not exists activities_job_idx on public.activities ((data ->> 'jobId'));

-- keep updated_at / updated_by current
create or replace function public.kerf_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['jobs', 'activities', 'customers', 'team', 'notes', 'settings'] loop
    execute format('drop trigger if exists kerf_touch on public.%I', t);
    execute format('create trigger kerf_touch before update on public.%I for each row execute function public.kerf_touch()', t);
  end loop;
end $$;

-- ---------- Merge-update so two people editing one job don't overwrite each other ----------
create or replace function public.kerf_jsonb_merge(a jsonb, b jsonb) returns jsonb
language sql immutable as $$
  select case
    when jsonb_typeof(a) = 'object' and jsonb_typeof(b) = 'object' then
      coalesce((
        select jsonb_object_agg(k,
          case when a ? k and b ? k then public.kerf_jsonb_merge(a -> k, b -> k)
               when b ? k then b -> k
               else a -> k end)
        from (select jsonb_object_keys(a) as k union select jsonb_object_keys(b)) keys
      ), '{}'::jsonb)
    else b
  end
$$;

create or replace function public.kerf_patch(tbl text, doc_id text, patch jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare n integer;
begin
  if tbl not in ('jobs', 'activities', 'customers', 'team', 'notes', 'settings') then
    raise exception 'Unknown table %', tbl using errcode = '22023';
  end if;
  execute format('update public.%I set data = public.kerf_jsonb_merge(data, $1) where id = $2', tbl) using patch, doc_id;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Not found or not allowed' using errcode = '42501';
  end if;
end $$;

-- ---------- Access rules ----------
do $$
declare t text;
begin
  -- everyday shop data: every active member reads and writes; only admin/sales delete
  foreach t in array array['jobs', 'activities', 'customers'] loop
    execute format('drop policy if exists kerf_read on public.%I', t);
    execute format('drop policy if exists kerf_insert on public.%I', t);
    execute format('drop policy if exists kerf_update on public.%I', t);
    execute format('drop policy if exists kerf_delete on public.%I', t);
    execute format('create policy kerf_read on public.%I for select to authenticated using (public.kerf_is_member())', t);
    execute format('create policy kerf_insert on public.%I for insert to authenticated with check (public.kerf_is_member())', t);
    execute format('create policy kerf_update on public.%I for update to authenticated using (public.kerf_is_member()) with check (public.kerf_is_member())', t);
    execute format('create policy kerf_delete on public.%I for delete to authenticated using (public.kerf_is_staff())', t);
  end loop;
  -- team list and price list: everyone reads, only admins change
  foreach t in array array['team', 'settings'] loop
    execute format('drop policy if exists kerf_read on public.%I', t);
    execute format('drop policy if exists kerf_insert on public.%I', t);
    execute format('drop policy if exists kerf_update on public.%I', t);
    execute format('drop policy if exists kerf_delete on public.%I', t);
    execute format('create policy kerf_read on public.%I for select to authenticated using (public.kerf_is_member())', t);
    execute format('create policy kerf_insert on public.%I for insert to authenticated with check (public.kerf_is_admin())', t);
    execute format('create policy kerf_update on public.%I for update to authenticated using (public.kerf_is_admin()) with check (public.kerf_is_admin())', t);
    execute format('create policy kerf_delete on public.%I for delete to authenticated using (public.kerf_is_admin())', t);
  end loop;
end $$;

-- notes: everyone reads and adds; admin/sales delete; nobody edits history
drop policy if exists kerf_read on public.notes;
drop policy if exists kerf_insert on public.notes;
drop policy if exists kerf_update on public.notes;
drop policy if exists kerf_delete on public.notes;
create policy kerf_read on public.notes for select to authenticated using (public.kerf_is_member());
create policy kerf_insert on public.notes for insert to authenticated with check (public.kerf_is_member());
create policy kerf_update on public.notes for update to authenticated using (public.kerf_is_admin()) with check (public.kerf_is_admin());
create policy kerf_delete on public.notes for delete to authenticated using (public.kerf_is_staff());

-- members: everyone sees who has a login; admins change access; new logins are created by the server only
drop policy if exists kerf_read on public.members;
drop policy if exists kerf_update on public.members;
drop policy if exists kerf_delete on public.members;
create policy kerf_read on public.members for select to authenticated using (public.kerf_is_member());
create policy kerf_update on public.members for update to authenticated using (public.kerf_is_admin()) with check (public.kerf_is_admin());
create policy kerf_delete on public.members for delete to authenticated using (public.kerf_is_admin() and user_id <> auth.uid());

-- ---------- Permissions for the website's signed-in users ----------
revoke all on public.members, public.jobs, public.activities, public.customers, public.team, public.notes, public.settings from anon;
grant select, update, delete on public.members to authenticated;
grant select, insert, update, delete on public.jobs, public.activities, public.customers, public.team, public.notes, public.settings to authenticated;
revoke execute on function public.kerf_patch(text, text, jsonb) from public, anon;
grant execute on function public.kerf_patch(text, text, jsonb) to authenticated;
grant execute on function public.kerf_jsonb_merge(jsonb, jsonb) to authenticated;
grant execute on function public.kerf_access(), public.kerf_is_member(), public.kerf_is_staff(), public.kerf_is_admin() to authenticated;
-- the website's server functions (secret key) manage logins
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.members, public.jobs, public.activities, public.customers, public.team, public.notes, public.settings to service_role;
    grant execute on function public.kerf_patch(text, text, jsonb) to service_role;
  end if;
end $$;

-- ---------- Live updates ----------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['jobs', 'activities', 'customers', 'team', 'notes', 'settings', 'members'] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end $$;

-- Done. Go back to your Kerf website and create the owner account.
