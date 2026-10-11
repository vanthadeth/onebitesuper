-- Recipes define consumption per unit; no finished-product stock or movements.
create function public.onebite_recipe_shape_valid(lines jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare line jsonb; seen text[]='{}'; n numeric;
begin
 if jsonb_typeof(lines) is distinct from 'array' then return false;end if;
 if jsonb_array_length(lines)>100 then return false;end if;
 for line in select value from jsonb_array_elements(lines) loop
  if not coalesce(jsonb_typeof(line)='object' and (select count(*) from jsonb_object_keys(line))=2 and line->>'itemId' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' and jsonb_typeof(line->'quantity')='number' and line->>'quantity' ~ '^\d+(\.\d{1,3})?$',false) then return false;end if;
  n=(line->>'quantity')::numeric;
  if n<=0 or n>1000000000 or line->>'itemId'=any(seen) then return false;end if;
  seen=array_append(seen,line->>'itemId');
 end loop;
 return true;
 exception when invalid_text_representation or numeric_value_out_of_range then return false;
end;
$$;
revoke all on function public.onebite_recipe_shape_valid(jsonb) from public,anon,authenticated;
grant execute on function public.onebite_recipe_shape_valid(jsonb) to service_role;
alter table public.onebite_catalog add column recipe jsonb not null default '[]'::jsonb check(public.onebite_recipe_shape_valid(recipe));
-- Retain all existing records and canonical item-field validation.
create or replace function public.onebite_catalog_valid(d jsonb) returns boolean language sql immutable security invoker set search_path='' as $$
 select coalesce(jsonb_typeof(d)='object' and
 d->>'id' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' and
 d->>'kind' in ('material','finished','sellable') and jsonb_typeof(d->'active')='boolean' and
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
 when d->>'kind'='finished' then d->>'packName'='' and d->'packQuantity'='null'::jsonb and d->'priceKhr'='null'::jsonb
 else d->>'packName'='' and d->'packQuantity'='null'::jsonb and jsonb_typeof(d->'priceKhr')='number' and case when d->>'priceKhr' ~ '^\d+$' then (d->>'priceKhr')::numeric<=1000000000 else false end end,false);
$$;

alter function public.onebite_inventory_api(text,jsonb,text) rename to onebite_inventory_references_api;
revoke all on function public.onebite_inventory_references_api(text,jsonb,text) from public,anon,authenticated;
create function public.onebite_inventory_api(p_action text,p_payload jsonb,p_session_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare g jsonb; d jsonb; lines jsonb; previous public.onebite_catalog%rowtype; component public.onebite_catalog%rowtype;
 line jsonb; op public.onebite_catalog_operations%rowtype; result jsonb; uid uuid;
begin
 if p_action<>'save' then
  result=public.onebite_inventory_references_api(p_action,p_payload,p_session_hash);
  if p_action='list' and not result ? 'error' then
   result=result||jsonb_build_object('items',coalesce((select jsonb_agg(data||jsonb_build_object('revision',revision,'recipe',recipe) order by lower(data->>'name'),id) from public.onebite_catalog),'[]'::jsonb));
  end if;
  return result;
 end if;
 g=public.onebite_session_guard(p_session_hash,true);
 if g ? 'error' then return g;end if;
 if g->'actor'->>'role'<>'Owner' or not public.onebite_has_permission('Owner','inventory.access') or not public.onebite_has_permission('Owner','catalog.manage') then return jsonb_build_object('error','forbidden');end if;
 uid=(g->'actor'->>'id')::uuid;
 d=p_payload->'item';
 if not coalesce(p_payload->>'id' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' and p_payload->>'fingerprint' ~ '^[a-f0-9]{64}$',false) or not public.onebite_catalog_valid(d-'revision'-'recipe') then return jsonb_build_object('error','invalid_item');end if;
 -- The reference lock also serializes component edits and recipes on other devices.
 perform pg_advisory_xact_lock(hashtextextended('inventory-references',0));
 perform pg_advisory_xact_lock(hashtextextended('inventory-op:'||(p_payload->>'id'),0));
 select * into op from public.onebite_catalog_operations where id=(p_payload->>'id')::uuid;
 if found then
  if op.actor_id<>uid or op.fingerprint<>p_payload->>'fingerprint' then return jsonb_build_object('error','operation_conflict');end if;
  return op.receipt;
 end if;
 select * into previous from public.onebite_catalog where id=(d->>'id')::uuid;
 if previous.id is not null and previous.data->>'kind'='finished' and previous.data->>'unit'<>d->>'unit' then return jsonb_build_object('error','immutable_unit');end if;
 -- Older clients omit recipes: preserve them rather than silently removing them.
 lines=case when d ? 'recipe' then d->'recipe' else coalesce(previous.recipe,'[]'::jsonb) end;
 if not public.onebite_recipe_shape_valid(lines) or d->>'kind'='material' and jsonb_array_length(lines)>0 or d->>'kind'='finished' and jsonb_array_length(lines)=0 then return jsonb_build_object('error','invalid_recipe');end if;
 for line in select value from jsonb_array_elements(lines) loop
  select * into component from public.onebite_catalog where id=(line->>'itemId')::uuid;
  if component.id is null or component.id=(d->>'id')::uuid or component.data->'active'<>'true'::jsonb or
   component.data->>'kind'='sellable' or d->>'kind'='finished' and component.data->>'kind'<>'material' or
   component.data->>'kind'='finished' and jsonb_array_length(component.recipe)=0 or
   component.data->>'unit'='pcs' and trunc((line->>'quantity')::numeric)<>(line->>'quantity')::numeric then return jsonb_build_object('error','invalid_recipe');end if;
  if component.data->>'kind'='finished' and exists(select 1 from jsonb_array_elements(component.recipe) raw left join public.onebite_catalog ingredient on ingredient.id=(raw->>'itemId')::uuid where ingredient.id is null or ingredient.data->'active'<>'true'::jsonb or ingredient.data->>'kind'<>'material') then return jsonb_build_object('error','invalid_recipe');end if;
 end loop;
 result=public.onebite_inventory_references_api('save',jsonb_set(p_payload,'{item}',d-'recipe'),p_session_hash);
 if result ? 'error' then return result;end if;
 update public.onebite_catalog set recipe=lines where id=(d->>'id')::uuid;
 result=jsonb_set(result,'{item,recipe}',lines);
 update public.onebite_catalog_operations set receipt=result where id=(p_payload->>'id')::uuid;
 return result;
 exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','invalid_recipe');
end;
$$;
revoke all on function public.onebite_inventory_api(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.onebite_inventory_api(text,jsonb,text) to service_role;
grant update(receipt) on public.onebite_catalog_operations to service_role;
