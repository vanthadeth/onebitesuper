-- Online control plane. No payment or order posting is enabled by this migration.
create table public.onebite_pos_devices (
 site_id integer primary key references public.onebite_sites(id),
 device_id uuid, proof_hash text, generation bigint not null default 0,
 registered_by uuid references public.onebite_users(id), registered_at timestamptz,
 check ((device_id is null) = (proof_hash is null)),
 check (proof_hash is null or proof_hash ~ '^[a-f0-9]{64}$')
);
create unique index onebite_pos_device_single_site on public.onebite_pos_devices(device_id) where device_id is not null;
create table public.onebite_pos_shifts (
 id uuid primary key, site_id integer not null references public.onebite_sites(id),
 opened_by uuid not null references public.onebite_users(id), opened_at timestamptz not null default now(),
 opening_cash bigint not null check(opening_cash between 0 and 1000000000000),
 opening_source text not null check(opening_source in ('zero','supply','retained')),
 closed_at timestamptz, closed_by uuid references public.onebite_users(id),
 counted_cash bigint check(counted_cash between 0 and 1000000000000), difference bigint,
 check ((closed_at is null) = (closed_by is null)), check ((closed_at is null) = (counted_cash is null))
);
create unique index onebite_pos_shared_shift on public.onebite_pos_shifts(site_id) where closed_at is null;
create table public.onebite_pos_custody (
 site_id integer primary key references public.onebite_sites(id),
 holder_id uuid not null references public.onebite_users(id),
 cash bigint not null check(cash between 0 and 1000000000000),
 shift_id uuid not null references public.onebite_pos_shifts(id), updated_at timestamptz not null default now()
);
create table public.onebite_pos_control_events (
 id uuid primary key, actor_id uuid not null references public.onebite_users(id),
 site_id integer not null references public.onebite_sites(id), action text not null,
 payload jsonb not null, result jsonb not null, recorded_at timestamptz not null default now()
);
alter table public.onebite_pos_devices enable row level security;
alter table public.onebite_pos_shifts enable row level security;
alter table public.onebite_pos_custody enable row level security;
alter table public.onebite_pos_control_events enable row level security;
revoke all on public.onebite_pos_devices,public.onebite_pos_shifts,public.onebite_pos_custody,public.onebite_pos_control_events from public,anon,authenticated,service_role;
grant select,insert,update on public.onebite_pos_devices,public.onebite_pos_shifts,public.onebite_pos_custody to service_role;
grant select,insert on public.onebite_pos_control_events to service_role;

create function public.onebite_pos_control(p_action text,p_payload jsonb,p_session_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 g jsonb; actor jsonb; aid uuid; sid integer; did uuid; rid uuid; proof text;
 device public.onebite_pos_devices; shift public.onebite_pos_shifts; custody public.onebite_pos_custody;
 previous public.onebite_pos_control_events; cash_amount bigint; source text; result jsonb; shift_json jsonb;
begin
 g=public.onebite_session_guard(p_session_hash,true);if g ? 'error' then return g;end if;
 actor=g->'actor';aid=(actor->>'id')::uuid;
 if not public.onebite_has_permission(actor->>'role','pos.access') then return jsonb_build_object('error','forbidden');end if;
 if p_action not in ('workspace','device.claim','device.release','shift.open','shift.close') then return jsonb_build_object('error','invalid_action');end if;
 if jsonb_typeof(p_payload)<>'object' or coalesce(p_payload->>'siteId','') !~ '^[0-9]{1,9}$'
  or coalesce(p_payload->>'deviceId','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  or coalesce(p_payload->>'proofHash','') !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','invalid_request');end if;
 sid=(p_payload->>'siteId')::integer;did=(p_payload->>'deviceId')::uuid;proof=p_payload->>'proofHash';
 -- Lock the site even before its device row exists: competing first claims/openings serialize.
 perform 1 from public.onebite_sites s where s.id=sid and s.active
  and (actor->>'role'='Owner' or exists(select 1 from public.onebite_user_sites u where u.site_id=s.id and u.user_id=aid)) for update;
 if not found then return jsonb_build_object('error','forbidden');end if;
 select * into device from public.onebite_pos_devices where site_id=sid;
 select * into shift from public.onebite_pos_shifts where site_id=sid and closed_at is null;
 select * into custody from public.onebite_pos_custody where site_id=sid;
 if p_action='workspace' then
  shift_json=case when shift.id is null then null else jsonb_build_object('id',shift.id,'openedAt',shift.opened_at,'openingCash',shift.opening_cash,'openingSource',shift.opening_source,'openedBy',shift.opened_by) end;
  return jsonb_build_object('siteId',sid,'registered',device.device_id is not null,
   'ordering',coalesce(device.device_id=did and device.proof_hash=proof,false),'generation',coalesce(device.generation,0),
   'shift',shift_json,'custody',case when custody.site_id is null then null else jsonb_build_object('holderId',custody.holder_id,'holderName',(select name from public.onebite_users where id=custody.holder_id),'cash',custody.cash) end,
   'recentShifts',coalesce((select jsonb_agg(rowdata order by closed_at desc) from (select closed_at,jsonb_build_object('id',id,'openedAt',opened_at,'closedAt',closed_at,'openingCash',opening_cash,'countedCash',counted_cash,'difference',difference) rowdata from public.onebite_pos_shifts where site_id=sid and closed_at is not null order by closed_at desc limit 10) history),'[]'::jsonb),
   'serverTime',now());
 end if;
 if not public.onebite_has_permission(actor->>'role','shifts.manage') then return jsonb_build_object('error','forbidden');end if;
 if coalesce(p_payload->>'requestId','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  or coalesce(p_payload->>'generation','') !~ '^[0-9]{1,12}$' then return jsonb_build_object('error','invalid_request');end if;
 rid=(p_payload->>'requestId')::uuid;
 perform pg_advisory_xact_lock(hashtextextended(rid::text,0));
 select * into previous from public.onebite_pos_control_events where id=rid;
 if found then
  if previous.actor_id<>aid or previous.site_id<>sid or previous.action<>p_action or previous.payload<>p_payload then return jsonb_build_object('error','request_conflict');end if;
  return previous.result;
 end if;
 if coalesce(device.generation,0)<>(p_payload->>'generation')::bigint then return jsonb_build_object('error','device_changed');end if;
 if p_action='device.claim' then
  if device.device_id is not null then return jsonb_build_object('error','device_in_use');end if;
  if exists(select 1 from public.onebite_pos_devices where device_id=did) then return jsonb_build_object('error','device_other_site');end if;
  insert into public.onebite_pos_devices(site_id,device_id,proof_hash,generation,registered_by,registered_at)
   values(sid,did,proof,coalesce(device.generation,0)+1,aid,now())
   on conflict(site_id) do update set device_id=excluded.device_id,proof_hash=excluded.proof_hash,generation=excluded.generation,registered_by=excluded.registered_by,registered_at=excluded.registered_at;
 else
  if device.device_id is distinct from did or device.proof_hash is distinct from proof then return jsonb_build_object('error','device_required');end if;
  if p_action='device.release' then
   if shift.id is not null then return jsonb_build_object('error','shift_active');end if;
   update public.onebite_pos_devices set device_id=null,proof_hash=null,generation=generation+1 where site_id=sid;
  elsif p_action='shift.open' then
   if shift.id is not null then return jsonb_build_object('error','shift_active');end if;
   if coalesce(p_payload->>'cash','') !~ '^[0-9]{1,13}$' then return jsonb_build_object('error','invalid_cash');end if;
   cash_amount=(p_payload->>'cash')::bigint;if cash_amount>1000000000000 then return jsonb_build_object('error','invalid_cash');end if;
   source=p_payload->>'source';
   if custody.site_id is not null and custody.cash>0 then
    if custody.holder_id<>aid then return jsonb_build_object('error','handover_required');end if;
    if source is distinct from 'retained' or cash_amount<>custody.cash then return jsonb_build_object('error','retained_cash_required');end if;
   elsif cash_amount=0 then
    if source is distinct from 'zero' then return jsonb_build_object('error','invalid_cash');end if;
   elsif source is distinct from 'supply' or actor->>'role' not in ('Owner','Supervisor') or not public.onebite_has_permission(actor->>'role','cash.withdraw') then
    return jsonb_build_object('error','cash_supplier_required');
   end if;
   insert into public.onebite_pos_shifts(id,site_id,opened_by,opening_cash,opening_source) values(rid,sid,aid,cash_amount,source);
   insert into public.onebite_pos_custody(site_id,holder_id,cash,shift_id) values(sid,aid,cash_amount,rid)
    on conflict(site_id) do update set holder_id=excluded.holder_id,cash=excluded.cash,shift_id=excluded.shift_id,updated_at=now();
  elsif p_action='shift.close' then
   if shift.id is null or p_payload->>'shiftId' is distinct from shift.id::text then return jsonb_build_object('error','shift_changed');end if;
   if custody.holder_id is distinct from aid then return jsonb_build_object('error','custodian_required');end if;
   if coalesce(p_payload->>'cash','') !~ '^[0-9]{1,13}$' then return jsonb_build_object('error','invalid_cash');end if;
   cash_amount=(p_payload->>'cash')::bigint;if cash_amount>1000000000000 then return jsonb_build_object('error','invalid_cash');end if;
   update public.onebite_pos_shifts set closed_at=now(),closed_by=aid,counted_cash=cash_amount,difference=cash_amount-custody.cash where id=shift.id;
   update public.onebite_pos_custody set cash=cash_amount,updated_at=now() where site_id=sid;
  end if;
 end if;
 result=jsonb_build_object('requestId',rid,'action',p_action,'recordedAt',now());
 insert into public.onebite_pos_control_events(id,actor_id,site_id,action,payload,result) values(rid,aid,sid,p_action,p_payload,result);
 insert into public.onebite_access_audit(actor_id,actor_name,action,target_name,detail) values(aid,actor->>'name','pos.'||p_action,(select name from public.onebite_sites where id=sid),case when p_action in ('shift.open','shift.close') then cash_amount::text||' KHR · '||rid::text else rid::text end);
 return result;
exception when unique_violation then return jsonb_build_object('error','device_in_use');
end;$$;
revoke all on function public.onebite_pos_control(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.onebite_pos_control(text,jsonb,text) to service_role;
