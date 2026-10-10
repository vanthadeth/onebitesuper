-- Service-only authentication boundary. Existing business mutations remain behind this guard.
alter table public.onebite_credentials add column totp_secret text,
 add column totp_counter bigint not null default -1,
 add column recovery_hashes text[] not null default array[]::text[];
alter table public.onebite_sessions add column last_seen timestamptz not null default now(),
 add column mfa_at timestamptz;
alter table public.onebite_sessions alter column expires_at set default now()+interval '8 hours';
-- Existing sessions have not passed the new security boundary.
delete from public.onebite_sessions;
create table public.onebite_security_events (
 id uuid primary key default gen_random_uuid(), time timestamptz not null default now(),
 actor_id uuid, action text not null, outcome text not null, request_id uuid
);
create index onebite_security_events_time_idx on public.onebite_security_events(time desc);
create table public.onebite_request_limits (
 key text primary key, window_start timestamptz not null, attempts integer not null
);
alter table public.onebite_security_events enable row level security;
alter table public.onebite_request_limits enable row level security;
revoke all on public.onebite_security_events,public.onebite_request_limits from public,anon,authenticated;
grant select,insert on public.onebite_security_events to service_role;
grant select,insert,update,delete on public.onebite_request_limits to service_role;

create function public.onebite_privileged(p_role text) returns boolean language sql stable security invoker set search_path='' as $$
 select p_role='Owner' or exists(select 1 from public.onebite_role_permissions where role=p_role
 and permission in ('roles.manage','users.manage','settings.manage','sites.manage','staff.assign'));
$$;
create function public.onebite_valid_pin(p_pin text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(p_pin ~ '^[0-9]{6}$' and p_pin !~ '^([0-9])\1{5}$'
 and p_pin not in ('123456','654321','012345','543210','111222','121212','112233','123123'),false);
$$;
create function public.onebite_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if length(p_key)>160 or p_limit not between 1 and 2000 or p_seconds not between 1 and 3600 then return false;end if;
 insert into public.onebite_request_limits(key,window_start,attempts) values(p_key,now(),1)
 on conflict(key) do update set
 attempts=case when onebite_request_limits.window_start<=now()-make_interval(secs=>p_seconds) then 1 else least(onebite_request_limits.attempts+1,p_limit+1) end,
 window_start=case when onebite_request_limits.window_start<=now()-make_interval(secs=>p_seconds) then now() else onebite_request_limits.window_start end
 returning attempts into n;
 return n<=p_limit;
end $$;
create function public.onebite_session_guard(p_hash text,p_sensitive boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.onebite_users%rowtype;s public.onebite_sessions%rowtype;c public.onebite_credentials%rowtype;
begin
 select * into s from public.onebite_sessions where token_hash=p_hash for update;
 if not found or s.expires_at<=now() or s.last_seen<=now()-interval '10 minutes' then
  delete from public.onebite_sessions where token_hash=p_hash;return jsonb_build_object('error','unauthorized');end if;
 select * into a from public.onebite_users where id=s.user_id and active;
 if not found then return jsonb_build_object('error','unauthorized');end if;
 select * into c from public.onebite_credentials where user_id=a.id;
 if c.must_change then return jsonb_build_object('error','pin_change_required');end if;
 if public.onebite_privileged(a.role) and s.mfa_at is null then return jsonb_build_object('error','mfa_required');end if;
 if p_sensitive and public.onebite_privileged(a.role) and s.mfa_at<now()-interval '5 minutes' then return jsonb_build_object('error','reauth_required');end if;
 update public.onebite_sessions set last_seen=now() where token_hash=p_hash;
 return jsonb_build_object('actor',public.onebite_account_json(a.id));
end $$;

alter function public.onebite_access_api(text,jsonb,text) rename to onebite_access_api_legacy;
create function public.onebite_access_api(p_action text,p_payload jsonb default '{}'::jsonb,p_session_hash text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.onebite_users%rowtype;t public.onebite_users%rowtype;c public.onebite_credentials%rowtype;
 s public.onebite_sessions%rowtype;r jsonb;g jsonb;uid uuid;next_role text;secret text;counter bigint;rh text;
 request_id uuid;ctx jsonb;privileged boolean;
begin
 ctx=coalesce(p_payload->'_context','{}'::jsonb);p_payload=p_payload-'_context';
 begin request_id=(ctx->>'request_id')::uuid;exception when invalid_text_representation then request_id=null;end;
 if p_action in ('login','bootstrap','bootstrap.status') then
  if not public.onebite_rate_limit('public-global',120,60)
   or not public.onebite_rate_limit('public-source:'||coalesce(ctx->>'source_hash','unknown'),30,60) then
   insert into public.onebite_security_events(action,outcome,request_id) values(p_action,'rate_limited',request_id);
   return jsonb_build_object('error','login_throttled');end if;
  if p_action='login' and not public.onebite_rate_limit('login-account:'||encode(extensions.digest(lower(trim(coalesce(p_payload->>'username',''))),'sha256'),'hex'),5,60) then
   return jsonb_build_object('error','login_throttled');end if;
  if p_action='bootstrap' and not public.onebite_valid_pin(p_payload->>'pin') then return jsonb_build_object('error','invalid_pin');end if;
  r=public.onebite_access_api_legacy(p_action,p_payload,p_session_hash);
  if p_action='login' then
   insert into public.onebite_security_events(actor_id,action,outcome,request_id)
   values((r->'actor'->>'id')::uuid,'login',case when r ? 'error' then 'rejected' else 'credential_verified' end,request_id);
   -- Hide account-existence differences in the unauthenticated response.
   if r ? 'error' then
    if r->>'error'='login_throttled' or coalesce(p_payload->>'pin','') !~ '^[0-9]{6}$' or not exists(select 1 from public.onebite_users where username=lower(trim(p_payload->>'username')) and active) then
     perform extensions.crypt('000000',extensions.gen_salt('bf',12));
    end if;
    return jsonb_build_object('error','invalid_credentials');end if;
  end if;
  if p_action in ('login','bootstrap') and not r ? 'error' then
   uid=(r->'actor'->>'id')::uuid;select * into c from public.onebite_credentials where user_id=uid;
   privileged=public.onebite_privileged(r->'actor'->>'role');
   if c.must_change or privileged then
    return jsonb_build_object('actor',r->'actor','mustChangePin',c.must_change,'mfaRequired',privileged,'mfaEnrollment',c.totp_counter<0);end if;
  end if;
  return r;
 end if;
 select * into s from public.onebite_sessions where token_hash=p_session_hash for update;
 if not found or s.expires_at<=now() or s.last_seen<=now()-interval '10 minutes' then
  delete from public.onebite_sessions where token_hash=p_session_hash;return jsonb_build_object('error','unauthorized');end if;
 select * into a from public.onebite_users where id=s.user_id and active;
 if not found then return jsonb_build_object('error','unauthorized');end if;
 select * into c from public.onebite_credentials where user_id=a.id for update;
 privileged=public.onebite_privileged(a.role);
 if p_action='logout' then
  delete from public.onebite_sessions where token_hash=p_session_hash;
  insert into public.onebite_security_events(actor_id,action,outcome,request_id) values(a.id,'logout','revoked',request_id);
  return jsonb_build_object('ok',true);end if;
 if p_action='me' and (c.must_change or (privileged and s.mfa_at is null)) then
  return jsonb_build_object('actor',public.onebite_account_json(a.id),'mustChangePin',c.must_change,'mfaRequired',privileged,'mfaEnrollment',c.totp_counter<0);end if;
 if p_action in ('mfa.enroll','mfa.context','mfa.confirm') then
  if c.must_change and c.totp_counter<0 then return jsonb_build_object('error','pin_change_required');end if;
  if not privileged then return jsonb_build_object('error','forbidden');end if;
  if c.locked_until>now() then return jsonb_build_object('error','login_throttled');end if;
  if not public.onebite_rate_limit('mfa:'||a.id::text,10,60) then return jsonb_build_object('error','login_throttled');end if;
  if p_action='mfa.enroll' then
   if c.totp_counter>=0 then return jsonb_build_object('error','forbidden');end if;
   secret=p_payload->>'secret';if secret is null or secret !~ '^[A-Z2-7]{32}$' then return jsonb_build_object('error','invalid_request');end if;
   update public.onebite_credentials set totp_secret=coalesce(totp_secret,secret) where user_id=a.id returning * into c;
   return jsonb_build_object('secret',c.totp_secret,'username',a.username);
  elsif p_action='mfa.context' then
   if c.totp_secret is null then return jsonb_build_object('error','mfa_required');end if;
   return jsonb_build_object('secret',c.totp_secret,'enrollment',c.totp_counter<0);
  else
   counter=(p_payload->>'counter')::bigint;rh=p_payload->>'recovery_hash';
   if (counter is null or counter<=c.totp_counter) and not coalesce(rh=any(c.recovery_hashes),false) then
    update public.onebite_credentials set failures=failures+1,locked_until=case when failures>=4 then now()+interval '15 minutes' else locked_until end where user_id=a.id;
    insert into public.onebite_security_events(actor_id,action,outcome,request_id) values(a.id,'mfa.verify','rejected',request_id);
    return jsonb_build_object('error','invalid_mfa');end if;
   if c.totp_counter<0 then
    if jsonb_array_length(coalesce(p_payload->'recovery_hashes','[]'::jsonb))<>8 then return jsonb_build_object('error','invalid_request');end if;
    update public.onebite_credentials set recovery_hashes=array(select jsonb_array_elements_text(p_payload->'recovery_hashes')) where user_id=a.id;
   end if;
   update public.onebite_credentials set totp_counter=greatest(totp_counter,coalesce(counter,totp_counter)),
    recovery_hashes=case when rh is null then recovery_hashes else array_remove(recovery_hashes,rh) end,failures=0,locked_until=null where user_id=a.id;
   update public.onebite_sessions set mfa_at=now(),last_seen=now() where token_hash=p_session_hash;
   insert into public.onebite_security_events(actor_id,action,outcome,request_id) values(a.id,'mfa.verify','verified',request_id);
   if c.must_change then return jsonb_build_object('actor',public.onebite_account_json(a.id),'mustChangePin',true);end if;
   return jsonb_build_object('actor',public.onebite_account_json(a.id),'state',public.onebite_access_snapshot(a.id));
  end if;
 end if;
 if p_action='pin.change' then
  if c.totp_counter>=0 and s.mfa_at is null then return jsonb_build_object('error','mfa_required');end if;
  if not public.onebite_valid_pin(p_payload->>'pin') then return jsonb_build_object('error','invalid_pin');end if;
  if length(coalesce(p_payload->>'current_pin',''))<>6 then return jsonb_build_object('error','invalid_credentials');end if;
 else
  g=public.onebite_session_guard(p_session_hash,p_action in ('permissions.update','role.create','user.create','user.update','pin.reset','settings.update','sites.assign'));
  if g ? 'error' then return g;end if;
 end if;
 -- Owner alone controls grants, regardless of configured roles.manage on other roles.
 if p_action in ('permissions.update','role.create') and a.role<>'Owner' then r=jsonb_build_object('error','forbidden');
 elsif p_action in ('user.create','user.update','pin.reset') and a.role<>'Owner' then
  if p_action<>'user.create' then select * into t from public.onebite_users where id=(p_payload->>'id')::uuid;end if;
  next_role=coalesce(p_payload->>'role',t.role);
  if public.onebite_privileged(next_role) or (t.id is not null and public.onebite_privileged(t.role)) then r=jsonb_build_object('error','forbidden');end if;

 end if;
 if p_action='user.update' and (a.role<>'Owner' or not public.onebite_has_permission(a.role,'staff.assign')) and p_payload ? 'sites' and coalesce(array(select jsonb_array_elements_text(p_payload->'sites'))::integer[],array[]::integer[]) is distinct from array(select site_id from public.onebite_user_sites where user_id=(p_payload->>'id')::uuid order by site_id) then r=jsonb_build_object('error','forbidden');end if;
 if r is null and p_action in ('user.create','pin.reset') and not public.onebite_valid_pin(p_payload->>'pin') then r=jsonb_build_object('error','invalid_pin');end if;
 if r is null and p_action in ('site.create','site.update') and p_payload->>'photoPath' is not null and not exists(select 1 from public.onebite_sites where id=coalesce((p_payload->>'id')::integer,-1) and photo_path=p_payload->>'photoPath') and not exists(select 1 from storage.objects where bucket_id='site-photos' and name=p_payload->>'photoPath' and created_at>now()-interval '24 hours') then r=jsonb_build_object('error','invalid_photo');end if;
 if r is null and p_action='site.photo.authorize' and (not public.onebite_rate_limit('upload:'||a.id::text,10,60) or not public.onebite_rate_limit('upload-global',100,60)) then r=jsonb_build_object('error','login_throttled');end if;
 if r is null then r=public.onebite_access_api_legacy(p_action,p_payload,p_session_hash);end if;
 if r ? 'error' then
  insert into public.onebite_security_events(actor_id,action,outcome,request_id) values(a.id,p_action,coalesce(r->>'error','rejected'),request_id);return r;end if;
 if p_action in ('permissions.update','role.create') then
  delete from public.onebite_sessions where user_id in(select id from public.onebite_users where role=coalesce(p_payload->>'role',p_payload->>'id'));
 end if;
 if p_action='pin.change' and privileged and s.mfa_at is null then
  return jsonb_build_object('actor',r->'actor','mustChangePin',false,'mfaRequired',true,'mfaEnrollment',c.totp_counter<0);end if;
 if p_action='me' or p_action='pin.change' then update public.onebite_sessions set last_seen=now() where token_hash=p_session_hash;end if;
 insert into public.onebite_security_events(actor_id,action,outcome,request_id) values(a.id,p_action,'allowed',request_id);
 if not exists(select 1 from public.onebite_sessions where token_hash=p_session_hash) then r=r-'state';end if;
 return r;
end $$;

alter function public.onebite_activity_page(jsonb,text) rename to onebite_activity_page_legacy;
create function public.onebite_activity_page(p_payload jsonb,p_session_hash text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare g jsonb;
begin
 g=public.onebite_session_guard(p_session_hash);if g ? 'error' then return g;end if;
 return public.onebite_activity_page_legacy(p_payload,p_session_hash);
end $$;
-- Explicitly retain the service-only API model for every new function.
revoke execute on function public.onebite_privileged(text),public.onebite_valid_pin(text),public.onebite_rate_limit(text,integer,integer),public.onebite_session_guard(text,boolean),public.onebite_access_api(text,jsonb,text),public.onebite_activity_page(jsonb,text) from public,anon,authenticated;
grant execute on function public.onebite_privileged(text),public.onebite_valid_pin(text),public.onebite_rate_limit(text,integer,integer),public.onebite_session_guard(text,boolean),public.onebite_access_api(text,jsonb,text),public.onebite_activity_page(jsonb,text) to service_role;

create or replace function public.onebite_access_snapshot(p_actor uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
 'version',1,'revision',(select revision from public.onebite_access_settings),
 'appSettings',(select app_settings from public.onebite_access_settings where id=true),
 'customRoles',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'description',r.description) order by r.created_at,r.id) from public.onebite_roles r where not r.builtin),'[]'::jsonb),
 'users',coalesce((select jsonb_agg(public.onebite_account_json(u.id) order by u.created_at) from public.onebite_users u where public.onebite_has_permission(a.role,'users.manage') or u.id=a.id or (public.onebite_has_permission(a.role,'staff.assign') and u.role<>'Owner' and exists(select 1 from public.onebite_user_sites x join public.onebite_user_sites y on y.site_id=x.site_id where x.user_id=a.id and y.user_id=u.id))),'[]'::jsonb),
 'sites',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'active',s.active,'location',s.location,'latitude',s.latitude,'longitude',s.longitude,'photoPath',s.photo_path,'workingHours',s.working_hours,'remarks',case when a.role='Owner' or public.onebite_has_permission(a.role,'sites.manage') then s.remarks else '' end,'runningFrom',s.running_from,'shutdownOn',s.shutdown_on) order by s.id) from public.onebite_sites s where a.role='Owner' or public.onebite_has_permission(a.role,'sites.manage') or exists(select 1 from public.onebite_user_sites us where us.user_id=a.id and us.site_id=s.id)),'[]'::jsonb),
 'grants',(select jsonb_object_agg(r.id,coalesce((select jsonb_agg(p.permission order by p.permission) from public.onebite_role_permissions p where p.role=r.id),'[]'::jsonb)) from public.onebite_roles r),
 'events',case when public.onebite_has_permission(a.role,'users.manage') then coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'time',e.time,'actorId',e.actor_id,'actorName',e.actor_name,'action',e.action,'targetName',e.target_name,'detail',e.detail) order by e.time) from (select * from public.onebite_access_audit order by time desc limit 200)e),'[]'::jsonb) else '[]'::jsonb end)
 from public.onebite_users a where a.id=p_actor and a.active;
$$;

-- Return only expired, unattached uploads belonging to the authorized uploader.
create function public.onebite_orphan_photos(p_session_hash text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare g jsonb;uid uuid;role_name text;paths jsonb;
begin
 g=public.onebite_session_guard(p_session_hash);if g ? 'error' then return g;end if;
 uid=(g->'actor'->>'id')::uuid;role_name=g->'actor'->>'role';
 if not public.onebite_has_permission(role_name,'sites.manage') then return jsonb_build_object('error','forbidden');end if;
 select coalesce(jsonb_agg(name),'[]'::jsonb) into paths from
 (select o.name from storage.objects o where o.bucket_id='site-photos' and (role_name='Owner' or split_part(o.name,'/',1)=uid::text)
 and o.created_at<now()-interval '24 hours' and not exists(select 1 from public.onebite_sites s where s.photo_path=o.name)
 order by o.created_at limit 20) old;
 return jsonb_build_object('paths',paths);
end $$;
revoke execute on function public.onebite_orphan_photos(text) from public,anon,authenticated;
grant execute on function public.onebite_orphan_photos(text) to service_role;
revoke update,delete on public.onebite_access_audit from service_role;
-- Maintenance runs as the database owner, not through the browser/service API.
create function public.onebite_security_maintenance() returns void language plpgsql security invoker set search_path='' as $$
begin
 delete from public.onebite_sessions where expires_at<now() or last_seen<now()-interval '10 minutes';
 delete from public.onebite_request_limits where window_start<now()-interval '1 day';
 delete from public.onebite_security_events where time<now()-interval '365 days';
end $$;
revoke execute on function public.onebite_security_maintenance() from public,anon,authenticated,service_role;
do $$begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  create extension if not exists pg_cron;
  perform cron.schedule('onebite-security-maintenance','*/15 * * * *','select public.onebite_security_maintenance()');
 end if;
end $$;
