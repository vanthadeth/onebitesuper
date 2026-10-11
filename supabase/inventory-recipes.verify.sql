-- Isolated transactional checks. All fixtures roll back, including sessions and images.
begin;
create function pg_temp.assert(ok boolean,message text) returns void language plpgsql as $$ begin if not coalesce(ok,false) then raise exception 'Inventory check failed: %',message;end if;end $$;
insert into public.onebite_users(id,name,username,role,active) values ('11111111-1111-4111-8111-111111111111','Catalog test Owner','catalog-test-owner','Owner',true),('22222222-2222-4222-8222-222222222222','Catalog test Cashier','catalog-test-cashier','Cashier',true);
insert into public.onebite_credentials(user_id,pin_hash,must_change) values ('11111111-1111-4111-8111-111111111111','test-only',false),('22222222-2222-4222-8222-222222222222','test-only',false);
insert into public.onebite_sessions(token_hash,user_id,expires_at,mfa_at) values(repeat('1',64),'11111111-1111-4111-8111-111111111111',now()+interval '1 day',now()),(repeat('2',64),'22222222-2222-4222-8222-222222222222',now()+interval '1 day',null);
insert into public.onebite_role_permissions(role,permission) values('Cashier','inventory.access') on conflict do nothing;

select pg_temp.assert(not has_table_privilege('anon','public.onebite_catalog_references','select'),'reference data is private');
select pg_temp.assert((public.onebite_inventory_api('reference.save','{}',repeat('2',64))->>'error')='forbidden','staff cannot manage references');
select pg_temp.assert(jsonb_array_length(public.onebite_inventory_api('list','{}',repeat('1',64))->'references')>=6,'reference lists are available');
select pg_temp.assert(not has_function_privilege('anon','public.onebite_inventory_api(text,jsonb,text)','execute'),'recipe API remains private');
set local role service_role;
do $$
declare wrapper jsonb; filling jsonb; finished jsonb; sellable jsonb; p jsonb; r jsonb; first_receipt jsonb; lines jsonb; bad jsonb;
begin
 wrapper=jsonb_build_object('id',gen_random_uuid(),'kind','material','name','Recipe test wrapper','nameEn','','category','ingredient','unit','pcs','priceKhr',null,'packName','','packQuantity',null,'description','','active',true,'photoPath',null,'revision',0);
 r=public.onebite_inventory_api('save',jsonb_build_object('id',gen_random_uuid(),'fingerprint',repeat('a',64),'item',wrapper),repeat('1',64));
 perform pg_temp.assert(r->'item'->>'revision'='1','raw material created');wrapper=r->'item';
 filling=(wrapper-'recipe')||jsonb_build_object('id',gen_random_uuid(),'name','Recipe test filling','unit','g','revision',0);
 r=public.onebite_inventory_api('save',jsonb_build_object('id',gen_random_uuid(),'fingerprint',repeat('a',64),'item',filling),repeat('1',64));filling=r->'item';
 lines=jsonb_build_array(jsonb_build_object('itemId',wrapper->>'id','quantity',1),jsonb_build_object('itemId',filling->>'id','quantity',3));
 finished=(wrapper-'recipe')||jsonb_build_object('id',gen_random_uuid(),'name','Recipe test fried dumpling','kind','finished','revision',0,'recipe',lines);
 -- Use an existing managed category; finished and sellable share item categories.
 r=public.onebite_inventory_api('reference.save',jsonb_build_object('id',gen_random_uuid(),'fingerprint',repeat('b',64),'reference',jsonb_build_object('id',gen_random_uuid(),'kind','sellable_category','value','Recipe test products','name','Recipe test products','active',true,'revision',0)),repeat('1',64));
 finished=jsonb_set(finished,'{category}','"Recipe test products"');
 p=jsonb_build_object('id',gen_random_uuid(),'fingerprint',repeat('c',64),'item',finished);
 r=public.onebite_inventory_api('save',p,repeat('1',64));first_receipt=r;
 perform pg_temp.assert(r->'item'->>'revision'='1' and r->'item'->'recipe'=lines,'finished recipe saved atomically');finished=r->'item';
 perform pg_temp.assert(public.onebite_inventory_api('save',p,repeat('1',64))=r,'retry preserves recipe receipt');
 perform pg_temp.assert(public.onebite_inventory_api('save',p||jsonb_build_object('fingerprint',repeat('d',64)),repeat('1',64))->>'error'='operation_conflict','changed retry rejected');
 sellable=finished||jsonb_build_object('id',gen_random_uuid(),'name','Recipe test small box','kind','sellable','unit','box','priceKhr',5000,'revision',0,'recipe',jsonb_build_array(jsonb_build_object('itemId',finished->>'id','quantity',5)));
 r=public.onebite_inventory_api('save',jsonb_build_object('id',gen_random_uuid(),'fingerprint',repeat('e',64),'item',sellable),repeat('1',64));
 perform pg_temp.assert(r->'item'->>'revision'='1' and r->'item'->'recipe'=sellable->'recipe','finished product added to sellable item');sellable=r->'item';
 bad=finished||jsonb_build_object('recipe',jsonb_build_array(jsonb_build_object('itemId',sellable->>'id','quantity',1)));
 perform pg_temp.assert(public.onebite_inventory_api('save',jsonb_build_object('id',gen_random_uuid(),'fingerprint',repeat('f',64),'item',bad),repeat('1',64))->>'error'='invalid_recipe','finished cannot contain sellable item');
 bad=finished||jsonb_build_object('recipe',jsonb_build_array(jsonb_build_object('itemId',finished->>'id','quantity',1)));
 perform pg_temp.assert(public.onebite_inventory_api('save',jsonb_build_object('id',gen_random_uuid(),'fingerprint',repeat('f',64),'item',bad),repeat('1',64))->>'error'='invalid_recipe','self reference blocked');
 bad=finished||jsonb_build_object('recipe',jsonb_build_array(jsonb_build_object('itemId',wrapper->>'id','quantity',0.5)));
 perform pg_temp.assert(public.onebite_inventory_api('save',jsonb_build_object('id',gen_random_uuid(),'fingerprint',repeat('f',64),'item',bad),repeat('1',64))->>'error'='invalid_recipe','fractional pieces blocked');
 bad=finished||jsonb_build_object('recipe',jsonb_build_array(jsonb_build_object('itemId',gen_random_uuid(),'quantity',1)));
 perform pg_temp.assert(public.onebite_inventory_api('save',jsonb_build_object('id',gen_random_uuid(),'fingerprint',repeat('f',64),'item',bad),repeat('1',64))->>'error'='invalid_recipe','missing ingredient blocked');
 bad=finished||jsonb_build_object('recipe',jsonb_build_array(lines->0,lines->0));
 perform pg_temp.assert(public.onebite_inventory_api('save',jsonb_build_object('id',gen_random_uuid(),'fingerprint',repeat('f',64),'item',bad),repeat('1',64))->>'error'='invalid_recipe','duplicate ingredient blocked');
 bad=jsonb_set(finished,'{recipe}','[]');
 perform pg_temp.assert(public.onebite_inventory_api('save',jsonb_build_object('id',gen_random_uuid(),'fingerprint',repeat('f',64),'item',bad),repeat('1',64))->>'error'='invalid_recipe','empty finished recipe blocked');
 bad=jsonb_set(finished,'{unit}','"g"');
 perform pg_temp.assert(public.onebite_inventory_api('save',jsonb_build_object('id',gen_random_uuid(),'fingerprint',repeat('f',64),'item',bad),repeat('1',64))->>'error'='immutable_unit','finished unit locked');
 r=public.onebite_inventory_api('save',jsonb_build_object('id',gen_random_uuid(),'fingerprint',repeat('f',64),'item',finished-'recipe'),repeat('1',64));
 perform pg_temp.assert(r->'item'->>'revision'='2' and r->'item'->'recipe'=lines,'older client preserves recipe');
 perform pg_temp.assert(public.onebite_inventory_api('save',p,repeat('1',64))=first_receipt,'old retry returns original recipe revision');
 perform pg_temp.assert(public.onebite_inventory_api('save',jsonb_build_object('id',gen_random_uuid(),'fingerprint',repeat('f',64),'item',finished),repeat('1',64))->>'error'='stale_revision','stale recipe does not overwrite');
 perform pg_temp.assert(public.onebite_inventory_api('save',jsonb_build_object('id',gen_random_uuid(),'fingerprint',repeat('f',64),'item',sellable),repeat('2',64))->>'error'='forbidden','staff cannot author recipes');
 perform pg_temp.assert(exists(select 1 from jsonb_array_elements(public.onebite_inventory_api('list','{}',repeat('2',64))->'items') item where item->>'id'=finished->>'id' and item->'recipe'=lines),'staff can view recipes');
end;
$$;
rollback;
