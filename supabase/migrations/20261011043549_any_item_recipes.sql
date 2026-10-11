-- Item type is classification, not a restriction on recipe sections.
create or replace function public.onebite_item_definition_valid(d jsonb,base jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare line jsonb; c jsonb; seen text[]='{}'; key text; n numeric;
begin
 if not coalesce(jsonb_typeof(d)='object' and (select count(*) from jsonb_object_keys(d))=7 and d->'schema'='1'::jsonb and d->>'type' in ('finished_good','raw_material','supplies','component') and jsonb_typeof(d->'canSell')='boolean' and jsonb_typeof(d->'batchYield')='number' and d->>'batchYield' ~ '^\d+(\.\d{1,6})?$' and (d->>'batchYield')::numeric>0 and (d->>'batchYield')::numeric<=1000000000 and jsonb_typeof(d->'effectiveAt')='string' and d->>'effectiveAt' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' and jsonb_typeof(d->'lines')='array' and jsonb_typeof(d->'conversions')='array',false) then return false;end if;
 if not isfinite((d->>'effectiveAt')::timestamptz) or jsonb_array_length(d->'lines')>100 or jsonb_array_length(d->'conversions')>30 then return false;end if;
 if d->'canSell'='true'::jsonb then
  if base->'priceKhr'='null'::jsonb or length(btrim(base->>'category'))=0 then return false;end if;
 else if base->'priceKhr'<>'null'::jsonb then return false;end if;end if;
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

