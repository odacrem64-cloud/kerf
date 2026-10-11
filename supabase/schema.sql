-- =====================================================================
-- Kerf database setup (multi-shop)
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run again later: it only adds or fixes what's missing.
-- =====================================================================

-- ---------- Shops ----------
create table if not exists public.shops (
  id         text primary key,
  name       text not null,
  join_code  text not null unique,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.shops enable row level security;

-- ---------- Who belongs to which shop ----------
-- access: 'admin' = owner/office (everything), 'staff' = sales, 'crew' = templaters, fabricators, installers
-- status: 'active' or 'pending' (asked to join, waiting for the owner)
do $$
begin
  -- the first version of Kerf had one shop per site; rebuild that table for many shops
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'members')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'members' and column_name = 'shop_id') then
    drop table public.members cascade;
  end if;
end $$;
create table if not exists public.members (
  user_id    uuid not null references auth.users (id) on delete cascade,
  shop_id    text not null references public.shops (id) on delete cascade,
  email      text,
  name       text,
  team_id    text,
  access     text not null default 'crew' check (access in ('admin', 'staff', 'crew')),
  status     text not null default 'active' check (status in ('active', 'pending')),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);
create index if not exists members_shop_idx on public.members (shop_id);
alter table public.members enable row level security;

create or replace function public.kerf_is_member(sid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and shop_id = sid and active and status = 'active')
$$;
create or replace function public.kerf_is_staff(sid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and shop_id = sid and active and status = 'active' and access in ('admin', 'staff'))
$$;
create or replace function public.kerf_is_admin(sid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and shop_id = sid and active and status = 'active' and access = 'admin')
$$;
create or replace function public.kerf_has_any_membership(sid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and shop_id = sid)
$$;

-- ---------- Shop data: one JSON document per row, tagged with its shop ----------
do $$
declare t text;
begin
  foreach t in array array['jobs', 'activities', 'customers', 'team', 'notes', 'settings', 'files', 'slabs'] loop
    execute format(
      'create table if not exists public.%I (
         id         text primary key,
         shop_id    text,
         data       jsonb not null default ''{}''::jsonb,
         updated_at timestamptz not null default now(),
         updated_by uuid default auth.uid()
       )', t);
    execute format('alter table public.%I add column if not exists shop_id text', t);
    execute format('create index if not exists %I on public.%I (shop_id)', t || '_shop_idx', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

alter table public.notes add column if not exists job_id text generated always as (data ->> 'jobId') stored;
alter table public.notes add column if not exists at bigint generated always as (floor(coalesce(nullif(data ->> 'at', ''), '0')::numeric)::bigint) stored;
create index if not exists notes_job_idx on public.notes (job_id);
create index if not exists notes_at_idx on public.notes (shop_id, at desc);

create or replace function public.kerf_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  new.shop_id := old.shop_id; -- rows never move between shops
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['jobs', 'activities', 'customers', 'team', 'notes', 'settings', 'files', 'slabs'] loop
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
  if tbl not in ('jobs', 'activities', 'customers', 'team', 'notes', 'settings', 'files', 'slabs') then
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
declare p text;
begin
  foreach t in array array['jobs', 'activities', 'customers', 'team', 'notes', 'settings', 'files', 'slabs'] loop
    foreach p in array array['kerf_read', 'kerf_insert', 'kerf_update', 'kerf_delete'] loop
      execute format('drop policy if exists %I on public.%I', p, t);
    end loop;
    execute format('create policy kerf_read on public.%I for select to authenticated using (public.kerf_is_member(shop_id))', t);
  end loop;
  -- everyday shop data: every active member writes; only owner/office/sales delete
  foreach t in array array['jobs', 'activities', 'customers', 'files', 'slabs'] loop
    execute format('create policy kerf_insert on public.%I for insert to authenticated with check (public.kerf_is_member(shop_id))', t);
    execute format('create policy kerf_update on public.%I for update to authenticated using (public.kerf_is_member(shop_id)) with check (public.kerf_is_member(shop_id))', t);
    execute format('create policy kerf_delete on public.%I for delete to authenticated using (public.kerf_is_staff(shop_id))', t);
  end loop;
  -- team list and price list: owner/office only
  foreach t in array array['team', 'settings'] loop
    execute format('create policy kerf_insert on public.%I for insert to authenticated with check (public.kerf_is_admin(shop_id))', t);
    execute format('create policy kerf_update on public.%I for update to authenticated using (public.kerf_is_admin(shop_id)) with check (public.kerf_is_admin(shop_id))', t);
    execute format('create policy kerf_delete on public.%I for delete to authenticated using (public.kerf_is_admin(shop_id))', t);
  end loop;
end $$;
-- notes: everyone adds; owner/office/sales delete; history isn't edited
create policy kerf_insert on public.notes for insert to authenticated with check (public.kerf_is_member(shop_id));
create policy kerf_update on public.notes for update to authenticated using (public.kerf_is_admin(shop_id)) with check (public.kerf_is_admin(shop_id));
create policy kerf_delete on public.notes for delete to authenticated using (public.kerf_is_staff(shop_id));

-- members: you see your own rows and your shop's team; owner/office change access; joining happens on the server
drop policy if exists kerf_read on public.members;
drop policy if exists kerf_update on public.members;
drop policy if exists kerf_delete on public.members;
create policy kerf_read on public.members for select to authenticated using (user_id = auth.uid() or public.kerf_is_member(shop_id));
create policy kerf_update on public.members for update to authenticated using (public.kerf_is_admin(shop_id)) with check (public.kerf_is_admin(shop_id));
create policy kerf_delete on public.members for delete to authenticated using (public.kerf_is_admin(shop_id) and user_id <> auth.uid());

-- shops: you see shops you belong to (or asked to join); owner/office rename
drop policy if exists kerf_read on public.shops;
drop policy if exists kerf_update on public.shops;
create policy kerf_read on public.shops for select to authenticated using (public.kerf_has_any_membership(id));
create policy kerf_update on public.shops for update to authenticated using (public.kerf_is_admin(id)) with check (public.kerf_is_admin(id));

-- clean up helpers from the first version
drop function if exists public.kerf_is_member();
drop function if exists public.kerf_is_staff();
drop function if exists public.kerf_is_admin();
drop function if exists public.kerf_access();

-- ---------- Profile photos: each person can change their own picture on the team list ----------
create or replace function public.kerf_set_my_photo(sid text, photo text) returns void
language plpgsql security definer set search_path = public as $$
declare tid text;
begin
  if photo is not null and (length(photo) > 120000 or photo !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$') then
    raise exception 'Use a smaller JPG or PNG' using errcode = '22023';
  end if;
  select team_id into tid from public.members where user_id = auth.uid() and shop_id = sid and active and status = 'active';
  if tid is null then
    raise exception 'You are not on this shop''s team' using errcode = '42501';
  end if;
  update public.team set data = jsonb_set(data, '{photo}', coalesce(to_jsonb(photo), 'null'::jsonb)) where id = tid and shop_id = sid;
end $$;
revoke execute on function public.kerf_set_my_photo(text, text) from public, anon;
grant execute on function public.kerf_set_my_photo(text, text) to authenticated;

-- ---------- Permissions ----------
revoke all on public.shops, public.members, public.jobs, public.activities, public.customers, public.team, public.notes, public.settings, public.files, public.slabs from anon;
grant select, update on public.shops to authenticated;
grant select, update, delete on public.members to authenticated;
grant select, insert, update, delete on public.jobs, public.activities, public.customers, public.team, public.notes, public.settings, public.files, public.slabs to authenticated;
revoke execute on function public.kerf_patch(text, text, jsonb) from public, anon;
grant execute on function public.kerf_patch(text, text, jsonb) to authenticated;
grant execute on function public.kerf_jsonb_merge(jsonb, jsonb) to authenticated;
grant execute on function public.kerf_is_member(text), public.kerf_is_staff(text), public.kerf_is_admin(text), public.kerf_has_any_membership(text) to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.shops, public.members, public.jobs, public.activities, public.customers, public.team, public.notes, public.settings, public.files, public.slabs to service_role;
    grant execute on function public.kerf_patch(text, text, jsonb) to service_role;
  end if;
end $$;

-- ---------- Live updates ----------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['jobs', 'activities', 'customers', 'team', 'notes', 'settings', 'files', 'slabs', 'members', 'shops'] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end $$;

-- ---------- Job files (drawings, photos, PDFs) ----------
-- Stored privately as  <shop id>/<job id>/<file>.  Only that shop's team can open them.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
      values ('kerf-files', 'kerf-files', false, 52428800)
      on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
    drop policy if exists kerf_files_read on storage.objects;
    drop policy if exists kerf_files_insert on storage.objects;
    drop policy if exists kerf_files_delete on storage.objects;
    create policy kerf_files_read on storage.objects for select to authenticated
      using (bucket_id = 'kerf-files' and public.kerf_is_member((storage.foldername(name))[1]));
    create policy kerf_files_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'kerf-files' and public.kerf_is_member((storage.foldername(name))[1]));
    create policy kerf_files_delete on storage.objects for delete to authenticated
      using (bucket_id = 'kerf-files' and public.kerf_is_staff((storage.foldername(name))[1]));
  end if;
end $$;

-- Done. Go back to your Kerf website.
