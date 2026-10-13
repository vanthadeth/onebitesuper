-- Central stock only. No prepared balances, dispatch, POS finalization or public table access.
create or replace function public.onebite_permission_ceiling(p_role text) returns text[] language sql stable security invoker set search_path='' as $$
 select case when exists(select 1 from public.onebite_roles where id=p_role) then
 array['pos.access','admin.access','inventory.access','orders.create','orders.discount','orders.complimentary','orders.cancel_unpaid','orders.qr_reference','shifts.manage','cash.withdraw','staff.assign','users.manage','roles.manage','sites.manage','settings.manage','stock.view','stock.receive'] || case when p_role='Owner' then array['catalog.manage','stock.opening'] else array[]::text[] end else array[]::text[] end;
$$;
create or replace function public.onebite_has_permission(p_role text,p_permission text) returns boolean language sql stable security invoker set search_path='' as $$
 select p_permission=any(public.onebite_permission_ceiling(p_role))
 and exists(select 1 from public.onebite_role_permissions where role=p_role and permission=p_permission)
 and exists(select 1 from public.onebite_role_permissions where role=p_role and permission=case
 when p_permission in ('pos.access','orders.create','orders.discount','orders.complimentary','orders.cancel_unpaid','orders.qr_reference','shifts.manage','cash.withdraw') then 'pos.access'
 when p_permission='attendance.access' then 'attendance.access'
 when p_permission in ('inventory.access','catalog.manage','stock.view','stock.receive','stock.opening') then 'inventory.access'
 when p_permission in ('admin.access','staff.assign','users.manage','roles.manage','sites.manage','settings.manage','rules.manage') then 'admin.access' else null end);
$$;
insert into public.onebite_role_permissions(role,permission) values('Owner','stock.view'),('Owner','stock.receive'),('Owner','stock.opening') on conflict do nothing;
create table public.onebite_stock_operations (
 id uuid primary key, actor_id uuid not null references public.onebite_users(id), device_id uuid not null, actor_name text not null,
 kind text not null check(kind in ('stock.opening','stock.receive')), fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 envelope jsonb not null, receipt jsonb not null, posted_at timestamptz not null default now()
);
create index onebite_stock_operations_actor_device_idx on public.onebite_stock_operations(actor_id,device_id,id);
create table public.onebite_stock_movements (
 id bigint generated always as identity primary key, operation_id uuid not null references public.onebite_stock_operations(id),
 item_id uuid not null references public.onebite_catalog(id), quantity numeric(20,6) not null check(quantity>0 and quantity<=1000000000),
 unit text not null, item_name text not null, item_name_en text not null,
 unique(operation_id,item_id)
);
create index onebite_stock_movements_item_idx on public.onebite_stock_movements(item_id,id);
alter table public.onebite_stock_operations enable row level security;
alter table public.onebite_stock_movements enable row level security;
revoke all on public.onebite_stock_operations,public.onebite_stock_movements from public,anon,authenticated,service_role;
grant select,insert on public.onebite_stock_operations,public.onebite_stock_movements to service_role;
revoke all on sequence public.onebite_stock_movements_id_seq from public,anon,authenticated,service_role;
grant usage,select on sequence public.onebite_stock_movements_id_seq to service_role;

create function public.onebite_stock_items() returns setof jsonb language sql stable security invoker set search_path='' as $$
 select latest.item from (
  select distinct on(item_id) item from public.onebite_item_versions where effective_at<=now() and published_at<=now() order by item_id,effective_at desc,revision desc
 ) latest where latest.item->'definition'->>'type' in ('raw_material','supplies') and latest.item->'definition'->'lines'='[]'::jsonb;
$$;
create function public.onebite_stock_api(p_action text,p_payload jsonb,p_session_hash text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare g jsonb;actor jsonb;uid uuid;role_id text;op jsonb;op_id uuid;device uuid;fingerprint text;old public.onebite_stock_operations%rowtype;
 payload jsonb;line jsonb;item jsonb;seen uuid[]='{}';item_id uuid;quantity numeric;receipt jsonb;ids jsonb;
begin
 g=public.onebite_session_guard(p_session_hash,p_action='post');if g ? 'error' then return g;end if;actor=g->'actor';uid=(actor->>'id')::uuid;role_id=actor->>'role';
 if not public.onebite_has_permission(role_id,'stock.view') then return jsonb_build_object('error','forbidden');end if;
 if p_action='list' then
  if not coalesce(p_payload->>'deviceId' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',false) or jsonb_typeof(p_payload->'operationIds') is distinct from 'array' then return jsonb_build_object('error','invalid_stock_payload');end if;
  ids=p_payload->'operationIds';if jsonb_array_length(ids)>1000 or exists(select 1 from jsonb_array_elements(ids) id where jsonb_typeof(id)<>'string' or not (id#>>'{}') ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') then return jsonb_build_object('error','invalid_stock_payload');end if;
  -- One SQL statement: balances and included IDs use the same MVCC snapshot.
  return jsonb_build_object('actor',actor,'canReceive',public.onebite_has_permission(role_id,'stock.receive'),'canOpen',role_id='Owner' and public.onebite_has_permission(role_id,'stock.opening'),
   'items',coalesce((select jsonb_agg(i order by i->>'name') from public.onebite_stock_items() i),'[]'::jsonb),
   'balances',coalesce((select jsonb_agg(jsonb_build_object('itemId',c.id,'quantity',coalesce(m.quantity,0)::text,'hasMovements',m.quantity is not null) order by c.id) from public.onebite_catalog c left join (select sm.item_id,sum(sm.quantity) quantity from public.onebite_stock_movements sm group by sm.item_id) m on m.item_id=c.id),'[]'::jsonb),
   'includedIds',coalesce((select jsonb_agg(o.id order by o.id) from public.onebite_stock_operations o where o.actor_id=uid and o.device_id=(p_payload->>'deviceId')::uuid and ids ? o.id::text),'[]'::jsonb),
   'movements',coalesce((select jsonb_agg(jsonb_build_object('id',m.id::text,'operationId',o.id,'itemId',m.item_id,'name',m.item_name,'nameEn',m.item_name_en,'quantity',m.quantity::text,'unit',m.unit,'kind',o.kind,'actorName',o.actor_name,'postedAt',o.posted_at,'reference',o.envelope->'payload'->>'reference','remarks',o.envelope->'payload'->>'remarks') order by m.id desc) from (select * from public.onebite_stock_movements order by id desc limit 100) m join public.onebite_stock_operations o on o.id=m.operation_id),'[]'::jsonb),'serverTime',now());
 end if;
 if p_action<>'post' then return jsonb_build_object('error','invalid_action');end if;
 op=p_payload->'operation';
 if jsonb_typeof(op) is distinct from 'object' or (select count(*) from jsonb_object_keys(op))<>11 or exists(select 1 from jsonb_object_keys(op) k where k not in ('schema','id','actorId','siteId','deviceId','kind','shiftId','createdAt','dependencies','payload','fingerprint')) or op->'schema' is distinct from '1'::jsonb or
 not coalesce(op->>'id' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',false) or
 not coalesce(op->>'deviceId' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',false) or op->'siteId' is distinct from 'null'::jsonb or op->'shiftId' is distinct from 'null'::jsonb or op->'dependencies' is distinct from '[]'::jsonb or op->>'actorId' is distinct from uid::text or not coalesce(op->>'fingerprint' ~ '^[a-f0-9]{64}$',false) then return jsonb_build_object('error','invalid_stock_operation');end if;
 if op->>'kind' not in ('stock.opening','stock.receive') or op->>'kind' is null then return jsonb_build_object('error','invalid_stock_operation');end if;
 if op->>'kind'='stock.opening' and (role_id<>'Owner' or not public.onebite_has_permission(role_id,'stock.opening')) or op->>'kind'='stock.receive' and not public.onebite_has_permission(role_id,'stock.receive') then return jsonb_build_object('error','forbidden');end if;
 if jsonb_typeof(op->'createdAt') is distinct from 'string' or (op->>'createdAt')::timestamptz>now()+interval '5 minutes' then return jsonb_build_object('error','invalid_stock_operation');end if;
 op_id=(op->>'id')::uuid;device=(op->>'deviceId')::uuid;fingerprint=op->>'fingerprint';
 perform pg_advisory_xact_lock(hashtextextended('onebite-stock:'||op_id,0));
 select * into old from public.onebite_stock_operations where id=op_id;
 if found then
  if old.actor_id<>uid or old.device_id<>device or old.fingerprint<>fingerprint or old.envelope<>op then return jsonb_build_object('error','operation_conflict');end if;
  return old.receipt;
 end if;
 payload=op->'payload';
 if jsonb_typeof(payload) is distinct from 'object' or (select count(*) from jsonb_object_keys(payload))<>3 or jsonb_typeof(payload->'reference') is distinct from 'string' or length(payload->>'reference')>100 or jsonb_typeof(payload->'remarks') is distinct from 'string' or length(payload->>'remarks')>500 or jsonb_typeof(payload->'lines') is distinct from 'array' then return jsonb_build_object('error','invalid_stock_payload');end if;
 if jsonb_array_length(payload->'lines') not between 1 and 50 then return jsonb_build_object('error','invalid_stock_payload');end if;
 for line in select value from jsonb_array_elements(payload->'lines') loop
  if jsonb_typeof(line) is distinct from 'object' or (select count(*) from jsonb_object_keys(line))<>3 or not coalesce(line->>'itemId' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',false) or jsonb_typeof(line->'quantity') is distinct from 'string' or not coalesce(line->>'quantity' ~ '^(0|[1-9][0-9]{0,9})(\.[0-9]{1,6})?$',false) or jsonb_typeof(line->'unit') is distinct from 'string' then return jsonb_build_object('error','invalid_stock_payload');end if;
  item_id=(line->>'itemId')::uuid;quantity=(line->>'quantity')::numeric;
  if item_id=any(seen) or quantity<=0 or quantity>1000000000 then return jsonb_build_object('error','invalid_stock_quantity');end if;seen=array_append(seen,item_id);
 end loop;
 -- Deterministic item locking serializes opening and receiving from different devices.
 perform id from public.onebite_catalog where id=any(seen) order by id for update;
 for line in select value from jsonb_array_elements(payload->'lines') loop
  item_id=(line->>'itemId')::uuid;
  select i into item from public.onebite_stock_items() i where i->>'id'=item_id::text;
  if not found or item->'active' is distinct from 'true'::jsonb or item->>'unit' is distinct from line->>'unit' then return jsonb_build_object('error','invalid_stock_item');end if;
  if op->>'kind'='stock.opening' and exists(select 1 from public.onebite_stock_movements sm where sm.item_id= (line->>'itemId')::uuid) then return jsonb_build_object('error','opening_exists');end if;
 end loop;
 receipt=jsonb_build_object('id',op_id,'fingerprint',fingerprint,'reference','ST-'||op_id::text,'acknowledgedAt',now());
 insert into public.onebite_stock_operations(id,actor_id,device_id,actor_name,kind,fingerprint,envelope,receipt) values(op_id,uid,device,actor->>'name',op->>'kind',fingerprint,op,receipt);
 for line in select value from jsonb_array_elements(payload->'lines') loop
  select i into item from public.onebite_stock_items() i where i->>'id'=line->>'itemId';
  insert into public.onebite_stock_movements(operation_id,item_id,quantity,unit,item_name,item_name_en) values(op_id,(line->>'itemId')::uuid,(line->>'quantity')::numeric,line->>'unit',item->>'name',coalesce(item->>'nameEn',''));
 end loop;
 insert into public.onebite_access_audit(actor_id,actor_name,action,target_name,detail) values(uid,actor->>'name',op->>'kind','Central stockroom',jsonb_array_length(payload->'lines')||' lines · '||(receipt->>'reference'));
 return receipt;
 exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then return jsonb_build_object('error','invalid_stock_payload');
end;$$;
revoke all on function public.onebite_stock_items(),public.onebite_stock_api(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.onebite_stock_items(),public.onebite_stock_api(text,jsonb,text) to service_role;
