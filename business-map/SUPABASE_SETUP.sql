-- Business Map v1.37 / Supabase setup
-- Run once in Supabase Studio > SQL Editor.

create table if not exists public.business_maps (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  comment text not null default '' check (char_length(comment) <= 200),
  image_path text not null,
  image_url text not null,
  client_updated_at bigint not null,
  updated_at timestamptz not null default now(),
  version text not null default 'v1.37'
);

alter table public.business_maps enable row level security;

drop policy if exists "business_maps_group_read" on public.business_maps;
create policy "business_maps_group_read"
on public.business_maps
for select
to authenticated
using (true);

drop policy if exists "business_maps_owner_insert" on public.business_maps;
create policy "business_maps_owner_insert"
on public.business_maps
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "business_maps_owner_update" on public.business_maps;
create policy "business_maps_owner_update"
on public.business_maps
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "business_maps_owner_delete" on public.business_maps;
create policy "business_maps_owner_delete"
on public.business_maps
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.business_maps to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-maps',
  'business-maps',
  true,
  15728640,
  array['image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Uploading a new file.
drop policy if exists "business_maps_storage_insert" on storage.objects;
create policy "business_maps_storage_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-maps'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Upsert needs SELECT + UPDATE in addition to INSERT.
drop policy if exists "business_maps_storage_select" on storage.objects;
create policy "business_maps_storage_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'business-maps'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "business_maps_storage_update" on storage.objects;
create policy "business_maps_storage_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'business-maps'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'business-maps'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "business_maps_storage_delete" on storage.objects;
create policy "business_maps_storage_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-maps'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Quick verification queries
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename = 'business_maps';

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'business-maps';
