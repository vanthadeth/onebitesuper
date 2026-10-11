-- Preserve item IDs and legacy transport fields. New clients use the independent definition.
alter table public.onebite_catalog add column definition jsonb;
-- Share one category namespace without removing historical reference IDs.
insert into public.onebite_catalog_references(kind,value,name,active)
 select 'sellable_category',value,name,active from public.onebite_catalog_references where kind='material_category' on conflict do nothing;
insert into public.onebite_catalog_references(kind,value,name) values
 ('sellable_category','main','Main'),('sellable_category','side','Side'),
 ('sellable_category','ready_to_cook','Ready to cook'),('sellable_category','drinks','Drinks'),
 ('unit','kg','Kilograms'),('unit','L','Litres') on conflict do nothing;
update public.onebite_catalog c set definition=jsonb_build_object(
 'schema',1,'type',case c.data->>'kind' when 'finished' then 'component' when 'sellable' then 'finished_good' else 'raw_material' end,
 'canSell',c.data->>'kind'='sellable','batchYield',1,'effectiveAt',c.updated_at,
 'lines',coalesce((select jsonb_agg(line||jsonb_build_object('unit',coalesce(child.data->>'unit',''),'section','ingredients')) from jsonb_array_elements(c.recipe) line left join public.onebite_catalog child on child.id=(line->>'itemId')::uuid),'[]'::jsonb),'conversions','[]'::jsonb);
alter table public.onebite_catalog alter column definition set not null;

create table public.onebite_item_versions (
 item_id uuid not null references public.onebite_catalog(id), revision bigint not null check(revision>0),
 effective_at timestamptz not null, published_at timestamptz not null default now(),
 item jsonb not null, primary key(item_id,revision), check(item->>'id'=item_id::text)
);
create index onebite_item_versions_effective_idx on public.onebite_item_versions(item_id,effective_at desc,revision desc);
alter table public.onebite_item_versions enable row level security;
revoke all on public.onebite_item_versions from public,anon,authenticated;
grant select,insert on public.onebite_item_versions to service_role;
insert into public.onebite_item_versions(item_id,revision,effective_at,published_at,item)
 select id,revision,updated_at,now(),data||jsonb_build_object('revision',revision,'recipe',recipe,'definition',definition) from public.onebite_catalog;

-- Canonical fields remain bounded, but price and category are now independent of legacy kind.
create or replace function public.onebite_catalog_valid(d jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
begin
 return coalesce(jsonb_typeof(d)='object' and (select count(*) from jsonb_object_keys(d))=12 and
 d->>'id' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' and
 d->>'kind' in ('material','finished','sellable') and jsonb_typeof(d->'active')='boolean' and
 jsonb_typeof(d->'name')='string' and length(btrim(d->>'name')) between 1 and 100 and
 jsonb_typeof(d->'nameEn')='string' and length(d->>'nameEn')<=100 and
 jsonb_typeof(d->'category')='string' and length(d->>'category')<=60 and
 jsonb_typeof(d->'unit')='string' and length(btrim(d->>'unit')) between 1 and 30 and
 jsonb_typeof(d->'description')='string' and length(d->>'description')<=2000 and
 jsonb_typeof(d->'packName')='string' and length(d->>'packName')<=60 and
 (d->'photoPath'='null'::jsonb or (jsonb_typeof(d->'photoPath')='string' and d->>'photoPath' ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.jpg$')) and
 (d->'priceKhr'='null'::jsonb or jsonb_typeof(d->'priceKhr')='number' and d->>'priceKhr' ~ '^\d+$' and (d->>'priceKhr')::numeric<=1000000000) and
 ((d->>'packName'='' and d->'packQuantity'='null'::jsonb) or length(btrim(d->>'packName'))>0 and jsonb_typeof(d->'packQuantity')='number' and d->>'packQuantity' ~ '^\d+(\.\d{1,6})?$' and (d->>'packQuantity')::numeric>0 and (d->>'packQuantity')::numeric<=1000000000 and (d->>'unit'<>'pcs' or trunc((d->>'packQuantity')::numeric)=(d->>'packQuantity')::numeric)),false);
 exception when invalid_text_representation or numeric_value_out_of_range then return false;
end;$$;

create function public.onebite_item_definition_valid(d jsonb,base jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare line jsonb; c jsonb; seen text[]='{}'; key text; n numeric;
begin
 if not coalesce(jsonb_typeof(d)='object' and (select count(*) from jsonb_object_keys(d))=7 and d->'schema'='1'::jsonb and d->>'type' in ('finished_good','raw_material','supplies','component') and jsonb_typeof(d->'canSell')='boolean' and jsonb_typeof(d->'batchYield')='number' and d->>'batchYield' ~ '^\d+(\.\d{1,6})?$' and (d->>'batchYield')::numeric>0 and (d->>'batchYield')::numeric<=1000000000 and jsonb_typeof(d->'effectiveAt')='string' and d->>'effectiveAt' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' and jsonb_typeof(d->'lines')='array' and jsonb_typeof(d->'conversions')='array',false) then return false;end if;
 if not isfinite((d->>'effectiveAt')::timestamptz) or jsonb_array_length(d->'lines')>100 or jsonb_array_length(d->'conversions')>30 then return false;end if;
 if d->'canSell'='true'::jsonb then
  if base->'priceKhr'='null'::jsonb or length(btrim(base->>'category'))=0 then return false;end if;
 else if base->'priceKhr'<>'null'::jsonb then return false;end if;end if;
 if d->>'type' in ('raw_material','supplies') and jsonb_array_length(d->'lines')<>0 then return false;end if;
 if d->>'type' in ('finished_good','component') and jsonb_array_length(d->'lines')=0 then return false;end if;
 for c in select value from jsonb_array_elements(d->'conversions') loop
  if not coalesce(jsonb_typeof(c)='object' and (select count(*) from jsonb_object_keys(c))=2 and jsonb_typeof(c->'unit')='string' and length(btrim(c->>'unit')) between 1 and 30 and c->>'unit'<>base->>'unit' and jsonb_typeof(c->'factor')='number' and c->>'factor' ~ '^\d+(\.\d{1,6})?$',false) then return false;end if;
  n=(c->>'factor')::numeric;
  if n<=0 or n>1000000000 or c->>'unit'=any(seen) then return false;end if;seen=array_append(seen,c->>'unit');
 end loop;
 seen='{}';
 for line in select value from jsonb_array_elements(d->'lines') loop
  if not coalesce(jsonb_typeof(line)='object' and (select count(*) from jsonb_object_keys(line))=4 and line->>'itemId' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' and line->>'itemId'<>base->>'id' and line->>'section' in ('ingredients','contents','packaging') and jsonb_typeof(line->'unit')='string' and length(btrim(line->>'unit')) between 1 and 30 and jsonb_typeof(line->'quantity')='number' and line->>'quantity' ~ '^\d+(\.\d{1,6})?$',false) then return false;end if;
  n=(line->>'quantity')::numeric;key=(line->>'section')||':'||(line->>'itemId');
  if n<=0 or n>1000000000 or key=any(seen) then return false;end if;seen=array_append(seen,key);
 end loop;
 return true;
 exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then return false;
end;$$;

create function public.onebite_item_recipe_valid(root_id uuid,d jsonb,base jsonb,path uuid[] default '{}') returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare line jsonb; child public.onebite_catalog%rowtype; factor numeric; amount numeric;
begin
 if root_id=any(path) or cardinality(path)>=20 then return false;end if;
 for line in select value from jsonb_array_elements(d->'lines') loop
  select * into child from public.onebite_catalog where id=(line->>'itemId')::uuid;
  if child.id is null or child.data->'active'<>'true'::jsonb then return false;end if;
  if line->>'unit'=child.data->>'unit' then factor=1;
  else
   select (value->>'factor')::numeric into factor from jsonb_array_elements(child.definition->'conversions') where value->>'unit'=line->>'unit';
   if factor is null then
    factor=case when line->>'unit'='kg' and child.data->>'unit'='g' or line->>'unit'='L' and child.data->>'unit'='ml' then 1000 when line->>'unit'='g' and child.data->>'unit'='kg' or line->>'unit'='ml' and child.data->>'unit'='L' then .001 else null end;
   end if;
  end if;
  if factor is null then return false;end if;
  amount=(line->>'quantity')::numeric*factor;
  if child.data->>'unit'='pcs' and trunc(amount)<>amount then return false;end if;
  if not public.onebite_item_recipe_valid(child.id,child.definition,child.data,array_append(path,root_id)) then return false;end if;
 end loop;
 return true;
end;$$;

alter function public.onebite_inventory_api(text,jsonb,text) rename to onebite_inventory_legacy_recipe_api;
revoke all on function public.onebite_inventory_legacy_recipe_api(text,jsonb,text) from public,anon,authenticated;
create function public.onebite_inventory_api(p_action text,p_payload jsonb,p_session_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare g jsonb; d jsonb; base jsonb; definition jsonb; previous public.onebite_catalog%rowtype; saved public.onebite_catalog%rowtype;
 op public.onebite_catalog_operations%rowtype; result jsonb; uid uuid; expected bigint; effective timestamptz;
begin
 if p_action<>'save' then
  result=public.onebite_inventory_legacy_recipe_api(p_action,p_payload,p_session_hash);
  if p_action='list' and not result ? 'error' then
   result=result||jsonb_build_object('items',coalesce((select jsonb_agg(c.data||jsonb_build_object('revision',c.revision,'recipe',c.recipe,'definition',c.definition) order by lower(c.data->>'name'),c.id) from public.onebite_catalog c),'[]'::jsonb),
    'versions',coalesce((select jsonb_agg(jsonb_build_object('item',item,'effectiveAt',effective_at,'publishedAt',published_at) order by item_id,revision) from public.onebite_item_versions),'[]'::jsonb));
  end if;
  return result;
 end if;
 g=public.onebite_session_guard(p_session_hash,true);
 if g ? 'error' then return g;end if;
 if g->'actor'->>'role'<>'Owner' or not public.onebite_has_permission('Owner','inventory.access') or not public.onebite_has_permission('Owner','catalog.manage') then return jsonb_build_object('error','forbidden');end if;
 uid=(g->'actor'->>'id')::uuid;d=p_payload->'item';definition=d->'definition';base=d-'revision'-'recipe'-'definition';
 -- Old clients may read, but must update before writing: never discard a versioned definition.
 if definition is null then return jsonb_build_object('error','client_update_required');end if;
 if not coalesce(p_payload->>'id' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' and p_payload->>'fingerprint' ~ '^[a-f0-9]{64}$' and d->>'revision' ~ '^\d+$',false) or not public.onebite_catalog_valid(base) or not public.onebite_item_definition_valid(definition,base) then return jsonb_build_object('error','invalid_item');end if;
 perform pg_advisory_xact_lock(hashtextextended('inventory-references',0));
 perform pg_advisory_xact_lock(hashtextextended('inventory-op:'||(p_payload->>'id'),0));
 select * into op from public.onebite_catalog_operations where id=(p_payload->>'id')::uuid;
 if found then
  if op.actor_id<>uid or op.fingerprint<>p_payload->>'fingerprint' then return jsonb_build_object('error','operation_conflict');end if;
  return op.receipt;
 end if;
 select * into previous from public.onebite_catalog where id=(d->>'id')::uuid for update;
 expected=(d->>'revision')::bigint;effective=(definition->>'effectiveAt')::timestamptz;
 if (previous.id is null and expected<>0) or (previous.id is not null and expected<>previous.revision) then return jsonb_build_object('error','stale_revision');end if;
 if previous.id is not null and previous.data->>'unit'<>base->>'unit' then return jsonb_build_object('error','immutable_unit');end if;
 if previous.id is null and base->'active'<>'true'::jsonb then return jsonb_build_object('error','invalid_active');end if;
 if previous.id is not null and previous.data->'active'<>base->'active' and p_payload->'confirmedActive' is distinct from 'true'::jsonb then return jsonb_build_object('error','confirmation_required');end if;
 if not exists(select 1 from public.onebite_catalog_references where kind='unit' and value=base->>'unit' and (active or previous.data->>'unit'=value)) or
  base->>'category'<>'' and not exists(select 1 from public.onebite_catalog_references where kind='sellable_category' and value=base->>'category' and (active or previous.data->>'category'=value)) then return jsonb_build_object('error','inactive_reference');end if;
 if not public.onebite_item_recipe_valid((base->>'id')::uuid,definition,base) then return jsonb_build_object('error','invalid_recipe');end if;
 -- Unified names remain unique across new item types. Historical duplicate names remain intact.
 if exists(select 1 from public.onebite_catalog where id<>(base->>'id')::uuid and lower(btrim(data->>'name'))=lower(btrim(base->>'name'))) then return jsonb_build_object('error','duplicate_item');end if;
 insert into public.onebite_catalog(id,data,definition,created_by,updated_by)
 values((base->>'id')::uuid,base,definition,uid,uid)
 on conflict(id) do update set data=excluded.data,definition=excluded.definition,revision=onebite_catalog.revision+1,updated_by=uid,updated_at=now()
 returning * into saved;
 result=jsonb_build_object('item',saved.data||jsonb_build_object('revision',saved.revision,'recipe',saved.recipe,'definition',saved.definition));
 insert into public.onebite_item_versions(item_id,revision,effective_at,item) values(saved.id,saved.revision,effective,result->'item');
 insert into public.onebite_catalog_operations(id,actor_id,fingerprint,receipt) values((p_payload->>'id')::uuid,uid,p_payload->>'fingerprint',result);
 insert into public.onebite_access_audit(actor_id,actor_name,action,target_name,detail) values(uid,g->'actor'->>'name',case when expected=0 then 'catalog.created' else 'catalog.updated' end,base->>'name',definition->>'type'||' · revision '||saved.revision||' · effective '||effective::text);
 return result;
 exception when unique_violation then return jsonb_build_object('error','duplicate_item');
 when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then return jsonb_build_object('error','invalid_item');
end;$$;
revoke all on function public.onebite_item_definition_valid(jsonb,jsonb),public.onebite_item_recipe_valid(uuid,jsonb,jsonb,uuid[]),public.onebite_inventory_api(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.onebite_item_definition_valid(jsonb,jsonb),public.onebite_item_recipe_valid(uuid,jsonb,jsonb,uuid[]),public.onebite_inventory_api(text,jsonb,text) to service_role;
