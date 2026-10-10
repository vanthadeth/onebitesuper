create or replace function public.onebite_catalog_valid(d jsonb) returns boolean language sql immutable security invoker set search_path='' as $$
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
 case when d->>'kind'='material' then d->'priceKhr'='null'::jsonb and
 ((d->>'packName'='' and d->'packQuantity'='null'::jsonb) or
 (length(btrim(d->>'packName'))>0 and jsonb_typeof(d->'packQuantity')='number' and case when (d->>'packQuantity') ~ '^\d+(\.\d{1,3})?$' then (d->>'packQuantity')::numeric>0 and (d->>'packQuantity')::numeric<=1000000000 and (d->>'unit'<>'pcs' or trunc((d->>'packQuantity')::numeric)=(d->>'packQuantity')::numeric) else false end))
 else d->>'packName'='' and d->'packQuantity'='null'::jsonb and jsonb_typeof(d->'priceKhr')='number' and case when d->>'priceKhr' ~ '^\d+$' then (d->>'priceKhr')::numeric<=1000000000 else false end end,false);
$$;

-- Shared reference lists are technical catalog configuration, not sample items.
create table public.onebite_catalog_references (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('material_category','sellable_category','unit')),
 value text not null check(length(btrim(value)) between 1 and 60),
 name text not null check(length(btrim(name)) between 1 and 60),
 active boolean not null default true,
 revision bigint not null default 1 check(revision>0),
 updated_by uuid references public.onebite_users(id),
 updated_at timestamptz not null default now(),
 check(kind<>'unit' or length(value)<=30)
);
create unique index onebite_catalog_references_value_idx on public.onebite_catalog_references(kind,lower(value));
create unique index onebite_catalog_references_name_idx on public.onebite_catalog_references(kind,lower(name));
create index onebite_catalog_references_updated_by_idx on public.onebite_catalog_references(updated_by);
alter table public.onebite_catalog_references enable row level security;
revoke all on public.onebite_catalog_references from public,anon,authenticated;
grant select,insert,update on public.onebite_catalog_references to service_role;
insert into public.onebite_catalog_references(kind,value,name) values
 ('material_category','ingredient','Ingredient'),('material_category','packaging','Packaging'),
 ('unit','pcs','Pieces'),('unit','g','Grams'),('unit','ml','Millilitres'),('unit','box','Box');
-- Preserve real categories and units already used by the business.
insert into public.onebite_catalog_references(kind,value,name)
 select distinct case when data->>'kind'='material' then 'material_category' else 'sellable_category' end,data->>'category',data->>'category' from public.onebite_catalog
 on conflict do nothing;
insert into public.onebite_catalog_references(kind,value,name)
 select distinct 'unit',data->>'unit','Unit · '||(data->>'unit') from public.onebite_catalog on conflict do nothing;

alter function public.onebite_inventory_api(text,jsonb,text) rename to onebite_inventory_catalog_api;
revoke all on function public.onebite_inventory_catalog_api(text,jsonb,text) from public,anon,authenticated;
create function public.onebite_inventory_api(p_action text,p_payload jsonb,p_session_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare g jsonb; uid uuid; d jsonb; existing public.onebite_catalog_references%rowtype;
 op public.onebite_catalog_operations%rowtype; op_id uuid; expected bigint; receipt jsonb; previous jsonb; kind_name text;
begin
 if p_action not in ('list','save','reference.save','photo.authorize','photo.read') then return jsonb_build_object('error','invalid_action');end if;
 g=public.onebite_session_guard(p_session_hash,p_action in ('save','reference.save','photo.authorize'));
 if g ? 'error' then return g;end if;
 if not public.onebite_has_permission(g->'actor'->>'role','inventory.access') then return jsonb_build_object('error','forbidden');end if;
 if p_action='list' then
  return public.onebite_inventory_catalog_api(p_action,p_payload,p_session_hash)||jsonb_build_object('references',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'value',value,'name',name,'active',active,'revision',revision) order by kind,name,id) from public.onebite_catalog_references),'[]'::jsonb));
 end if;
 if p_action in ('photo.read','photo.authorize') then return public.onebite_inventory_catalog_api(p_action,p_payload,p_session_hash);end if;
 if g->'actor'->>'role'<>'Owner' or not public.onebite_has_permission('Owner','catalog.manage') then return jsonb_build_object('error','forbidden');end if;
 uid=(g->'actor'->>'id')::uuid;
 if not coalesce(p_payload->>'id' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' and p_payload->>'fingerprint' ~ '^[a-f0-9]{64}$',false) then return jsonb_build_object('error','invalid_item');end if;
 op_id=(p_payload->>'id')::uuid;
 -- Serialize reference status changes with catalog selections across devices.
 perform pg_advisory_xact_lock(hashtextextended('inventory-references',0));
 perform pg_advisory_xact_lock(hashtextextended('inventory-op:'||op_id::text,0));
 select * into op from public.onebite_catalog_operations where id=op_id;
 if found then
  if op.actor_id<>uid or op.fingerprint<>p_payload->>'fingerprint' then return jsonb_build_object('error','operation_conflict');end if;
  return op.receipt;
 end if;
 if p_action='save' then
  d=p_payload->'item';
  if not public.onebite_catalog_valid(d-'revision') then return jsonb_build_object('error','invalid_item');end if;
  select data into previous from public.onebite_catalog where id=(d->>'id')::uuid;
  if previous is null and d->'active'<>'true'::jsonb then return jsonb_build_object('error','invalid_active');end if;
  if previous is not null and previous->'active'<>d->'active' and p_payload->'confirmedActive' is distinct from 'true'::jsonb then return jsonb_build_object('error','confirmation_required');end if;
  kind_name=case when d->>'kind'='material' then 'material_category' else 'sellable_category' end;
  if not exists(select 1 from public.onebite_catalog_references where kind=kind_name and lower(value)=lower(d->>'category') and (active or lower(previous->>'category')=lower(value)))
   or not exists(select 1 from public.onebite_catalog_references where kind='unit' and lower(value)=lower(d->>'unit') and (active or lower(previous->>'unit')=lower(value))) then return jsonb_build_object('error','inactive_reference');end if;
  return public.onebite_inventory_catalog_api(p_action,p_payload,p_session_hash);
 end if;
 d=p_payload->'reference';
 if not coalesce(jsonb_typeof(d)='object' and (select count(*) from jsonb_object_keys(d))=6 and
  d->>'id' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' and
  d->>'kind' in ('material_category','sellable_category','unit') and
  jsonb_typeof(d->'name')='string' and length(btrim(d->>'name')) between 1 and 60 and
  jsonb_typeof(d->'value')='string' and btrim(d->>'value') not in ('__create__','__manage__','all') and length(btrim(d->>'value')) between 1 and case when d->>'kind'='unit' then 30 else 60 end and
  jsonb_typeof(d->'active')='boolean' and d->>'revision' ~ '^\d+$',false) then return jsonb_build_object('error','invalid_reference');end if;
 expected=(d->>'revision')::bigint;
 select * into existing from public.onebite_catalog_references where id=(d->>'id')::uuid for update;
 if (found and expected<>existing.revision) or (not found and expected<>0) then return jsonb_build_object('error','stale_revision');end if;
 if existing.id is null and d->'active'<>'true'::jsonb then return jsonb_build_object('error','invalid_active');end if;
 if existing.id is not null then
  if existing.kind<>d->>'kind' or existing.value<>btrim(d->>'value') then return jsonb_build_object('error','immutable_reference');end if;
  if existing.active<>(d->>'active')::boolean and p_payload->'confirmedActive' is distinct from 'true'::jsonb then return jsonb_build_object('error','confirmation_required');end if;
 end if;
 insert into public.onebite_catalog_references(id,kind,value,name,active,updated_by)
 values((d->>'id')::uuid,d->>'kind',btrim(d->>'value'),btrim(d->>'name'),(d->>'active')::boolean,uid)
 on conflict(id) do update set name=excluded.name,active=excluded.active,revision=onebite_catalog_references.revision+1,updated_by=uid,updated_at=now()
 returning * into existing;
 receipt=jsonb_build_object('reference',jsonb_build_object('id',existing.id,'kind',existing.kind,'value',existing.value,'name',existing.name,'active',existing.active,'revision',existing.revision));
 insert into public.onebite_catalog_operations(id,actor_id,fingerprint,receipt) values(op_id,uid,p_payload->>'fingerprint',receipt);
 insert into public.onebite_access_audit(actor_id,actor_name,action,target_name,detail)
 values(uid,g->'actor'->>'name',case when expected=0 then 'catalog.reference.created' else 'catalog.reference.updated' end,existing.name,existing.kind||' · revision '||existing.revision);
 return receipt;
 exception when unique_violation then return jsonb_build_object('error','duplicate_reference');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','invalid_reference');
end;
$$;
revoke all on function public.onebite_inventory_api(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.onebite_inventory_api(text,jsonb,text) to service_role;
