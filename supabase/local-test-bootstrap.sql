create role anon;create role authenticated;create role service_role bypassrls;
create schema extensions;create schema storage;
grant usage on schema public,extensions,storage to service_role,anon,authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now(),primary key(bucket_id,name));
grant all on all tables in schema storage to service_role;
