-- Catalog-only milestone. No sample business records or stock balances.
create or replace function public.onebite_permission_ceiling(p_role text) returns text[] language sql stable security invoker set search_path='' as $$
 select case when exists(select 1 from public.onebite_roles where id=p_role) then
 array['pos.access','admin.access','inventory.access','orders.create','orders.discount','orders.complimentary','orders.cancel_unpaid','orders.qr_reference','shifts.manage','cash.withdraw','staff.assign','users.manage','roles.manage','sites.manage','settings.manage'] || case when p_role='Owner' then array['catalog.manage'] else array[]::text[] end else array[]::text[] end;
$$;
create or replace function public.onebite_has_permission(p_role text,p_permission text) returns boolean language sql stable security invoker set search_path='' as $$
 select p_permission=any(public.onebite_permission_ceiling(p_role))
 and exists(select 1 from public.onebite_role_permissions where role=p_role and permission=p_permission)
 and exists(select 1 from public.onebite_role_permissions where role=p_role and permission=case
 when p_permission in ('pos.access','orders.create','orders.discount','orders.complimentary','orders.cancel_unpaid','orders.qr_reference','shifts.manage','cash.withdraw') then 'pos.access'
 when p_permission='attendance.access' then 'attendance.access'
 when p_permission in ('inventory.access','catalog.manage') then 'inventory.access'
 when p_permission in ('admin.access','staff.assign','users.manage','roles.manage','sites.manage','settings.manage','rules.manage') then 'admin.access' else null end);
$$;
insert into public.onebite_role_permissions(role,permission) values ('Owner','inventory.access'),('Owner','catalog.manage') on conflict do nothing;
update public.onebite_access_settings set revision=revision+1;
create function public.onebite_catalog_valid(d jsonb) returns boolean language sql immutable security invoker set search_path='' as $$
 select coalesce(jsonb_typeof(d)='object' and
 d->>'id' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' and
 d->>'kind' in ('material','sellable') and jsonb_typeof(d->'active')='boolean' and
 jsonb_typeof(d->'name')='string' and length(btrim(d->>'name')) between 1 and 100 and
 jsonb_typeof(d->'nameEn')='string' and length(d->>'nameEn')<=100 and
 jsonb_typeof(d->'category')='string' and length(btrim(d->>'category')) between 1 and 60 and
 jsonb_typeof(d->'unit')='string' and length(btrim(d->>'unit')) between 1 and 30 and
 jsonb_typeof(d->'description')='string' and length(d->>'description')<=2000 and
 jsonb_typeof(d->'packName')='string' and length(d->>'packName')<=60 and
 (d->'photoPath'='null'::jsonb or (jsonb_typeof(d->'photoPath')='string' and d->>'photoPath' ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.jpg$')) and
 case when d->>'kind'='material' then d->>'category' in ('ingredient','packaging') and d->>'unit' in ('pcs','g','ml') and d->'priceKhr'='null'::jsonb and
 ((d->>'packName'='' and d->'packQuantity'='null'::jsonb) or
 (length(btrim(d->>'packName'))>0 and jsonb_typeof(d->'packQuantity')='number' and case when (d->>'packQuantity') ~ '^\d+(\.\d{1,3})?$' then (d->>'packQuantity')::numeric>0 and (d->>'packQuantity')::numeric<=1000000000 and (d->>'unit'<>'pcs' or trunc((d->>'packQuantity')::numeric)=(d->>'packQuantity')::numeric) else false end))
 else d->>'packName'='' and d->'packQuantity'='null'::jsonb and jsonb_typeof(d->'priceKhr')='number' and case when d->>'priceKhr' ~ '^\d+$' then (d->>'priceKhr')::numeric<=1000000000 else false end end,false);
$$;
create table public.onebite_catalog (
 id uuid primary key, data jsonb not null, revision bigint not null default 1 check(revision>0),
 created_by uuid not null references public.onebite_users(id), updated_by uuid not null references public.onebite_users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(public.onebite_catalog_valid(data)), check(data->>'id'=id::text)
);
create unique index onebite_catalog_name_idx on public.onebite_catalog((data->>'kind'),lower(btrim(data->>'name')));
create index onebite_catalog_created_by_idx on public.onebite_catalog(created_by);
create index onebite_catalog_updated_by_idx on public.onebite_catalog(updated_by);
create table public.onebite_catalog_operations (
 id uuid primary key, actor_id uuid not null references public.onebite_users(id), fingerprint text not null,
 receipt jsonb not null, created_at timestamptz not null default now()
);
create index onebite_catalog_operations_actor_idx on public.onebite_catalog_operations(actor_id);
alter table public.onebite_catalog enable row level security;
alter table public.onebite_catalog_operations enable row level security;
revoke all on public.onebite_catalog,public.onebite_catalog_operations from public,anon,authenticated;
grant select,insert,update on public.onebite_catalog to service_role;
grant select,insert on public.onebite_catalog_operations to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('catalog-photos','catalog-photos',false,750000,array['image/jpeg']);

create function public.onebite_inventory_api(p_action text,p_payload jsonb,p_session_hash text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare g jsonb; uid uuid; role_name text; d jsonb; expected bigint; row_item public.onebite_catalog%rowtype; op public.onebite_catalog_operations%rowtype; op_id uuid; fingerprint text; receipt jsonb;
begin
 if p_action not in ('list','save','photo.authorize','photo.read') then return jsonb_build_object('error','invalid_action');end if;
 g=public.onebite_session_guard(p_session_hash,p_action in ('save','photo.authorize'));
 if g ? 'error' then return g;end if;
 uid=(g->'actor'->>'id')::uuid;role_name=g->'actor'->>'role';
 if not public.onebite_has_permission(role_name,'inventory.access') then return jsonb_build_object('error','forbidden');end if;
 if p_action='list' then return g||jsonb_build_object('canEdit',role_name='Owner' and public.onebite_has_permission(role_name,'catalog.manage'),'items',coalesce((select jsonb_agg(data||jsonb_build_object('revision',revision) order by lower(data->>'name'),id) from public.onebite_catalog),'[]'::jsonb));end if;
 if p_action='photo.read' then
  if not exists(select 1 from public.onebite_catalog where data->>'photoPath'=p_payload->>'photoPath') then return jsonb_build_object('error','not_found');end if;
  return jsonb_build_object('photoPath',p_payload->>'photoPath');
 end if;
 -- Catalog authoring is explicitly Owner-only even if a role was granted an action.
 if role_name<>'Owner' or not public.onebite_has_permission(role_name,'catalog.manage') then return jsonb_build_object('error','forbidden');end if;
 if p_action='photo.authorize' then return g;end if;
 if coalesce(p_payload->>'id' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' or p_payload->>'fingerprint' !~ '^[a-f0-9]{64}$' or not coalesce(p_payload->'item'->>'revision' ~ '^\d+$',false),true) then return jsonb_build_object('error','invalid_item');end if;
 d=p_payload->'item';expected=(d->>'revision')::bigint;d=d-'revision';
 -- Canonical fields only; no caller-controlled audit or permission information.
 if not public.onebite_catalog_valid(d) or (select count(*) from jsonb_object_keys(d))<>12 then return jsonb_build_object('error','invalid_item');end if;
 op_id=(p_payload->>'id')::uuid;fingerprint=p_payload->>'fingerprint';
 -- Session lock serializes a token; advisory operation/item locks cover other devices.
 perform pg_advisory_xact_lock(hashtextextended('inventory-op:'||op_id::text,0));
 select * into op from public.onebite_catalog_operations where id=op_id;
 if found then
  if op.actor_id<>uid or op.fingerprint<>fingerprint then return jsonb_build_object('error','operation_conflict');end if;
  return op.receipt;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('inventory-item:'||(d->>'id'),0));
 select * into row_item from public.onebite_catalog where id=(d->>'id')::uuid for update;
 if (found and expected<>row_item.revision) or (not found and expected<>0) then return jsonb_build_object('error','stale_revision');end if;
 if row_item.id is not null and (row_item.data->>'kind'<>d->>'kind' or row_item.data->>'unit'<>d->>'unit' and row_item.data->>'kind'='material') then return jsonb_build_object('error','immutable_unit');end if;
 if d->'photoPath'<>'null'::jsonb and d->>'photoPath' is distinct from row_item.data->>'photoPath' and
 (d->>'photoPath'<>uid::text||'/'||op_id::text||'.jpg' or not exists(select 1 from storage.objects where bucket_id='catalog-photos' and name=d->>'photoPath')) then return jsonb_build_object('error','invalid_photo');end if;
 insert into public.onebite_catalog(id,data,created_by,updated_by) values((d->>'id')::uuid,d,uid,uid)
 on conflict(id) do update set data=excluded.data,revision=onebite_catalog.revision+1,updated_by=uid,updated_at=now()
 returning * into row_item;
 receipt=jsonb_build_object('item',row_item.data||jsonb_build_object('revision',row_item.revision));
 insert into public.onebite_catalog_operations(id,actor_id,fingerprint,receipt) values(op_id,uid,fingerprint,receipt);
 insert into public.onebite_access_audit(actor_id,actor_name,action,target_name,detail) values(uid,g->'actor'->>'name',case when expected=0 then 'catalog.created' else 'catalog.updated' end,d->>'name',(d->>'kind')||' · revision '||row_item.revision);
 return receipt;
 exception when unique_violation then return jsonb_build_object('error','duplicate_item');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','invalid_item');
end;
$$;
revoke all on function public.onebite_catalog_valid(jsonb),public.onebite_inventory_api(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.onebite_catalog_valid(jsonb),public.onebite_inventory_api(text,jsonb,text) to service_role;
