create or replace function public.onebite_valid_working_hours(p_hours jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare h jsonb; seen integer[]:=array[]::integer[]; d integer;
begin
 if p_hours is null or jsonb_typeof(p_hours)<>'array' then return false;end if;
 if jsonb_array_length(p_hours)>7 then return false;end if;
 for h in select value from jsonb_array_elements(p_hours) loop
  if jsonb_typeof(h)<>'object' or jsonb_typeof(h->'day') is distinct from 'number' or (h->>'day') !~ '^[0-6]$' or jsonb_typeof(h->'opens') is distinct from 'string' or jsonb_typeof(h->'closes') is distinct from 'string' then return false;end if;
  d=(h->>'day')::integer;
  if d=any(seen) or (h->>'opens') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (h->>'closes') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or h->>'opens'=h->>'closes' then return false;end if;
  seen=array_append(seen,d);
 end loop;
 return true;
end $$;
revoke execute on function public.onebite_valid_working_hours(jsonb) from public,anon,authenticated;
grant execute on function public.onebite_valid_working_hours(jsonb) to service_role;
alter table public.onebite_sites
 add column location text not null default '' check(length(location)<=500),
 add column latitude double precision check(latitude between -90 and 90),
 add column longitude double precision check(longitude between -180 and 180),
 add column working_hours jsonb not null default '[]'::jsonb check(public.onebite_valid_working_hours(working_hours)),
 add column remarks text not null default '' check(length(remarks)<=2000),
 add column running_from date not null default ((now() at time zone 'Asia/Phnom_Penh')::date) check(running_from between date '1900-01-01' and date '9999-12-31'),
 add column shutdown_on date check(shutdown_on between date '1900-01-01' and date '9999-12-31'),
 add constraint onebite_sites_operating_dates check(shutdown_on is null or shutdown_on>=running_from);
alter table public.onebite_sites add constraint onebite_sites_name_length check(length(btrim(name)) between 1 and 100);
create unique index onebite_sites_name_unique on public.onebite_sites(lower(btrim(name)));
create or replace function public.onebite_permission_ceiling(p_role text) returns text[] language sql stable set search_path='' as $$
 select case when exists(select 1 from public.onebite_roles where id=p_role) then array['pos.access','admin.access','orders.create','orders.discount','orders.complimentary','orders.cancel_unpaid','orders.qr_reference','shifts.manage','cash.withdraw','staff.assign','users.manage','roles.manage','sites.manage'] else array[]::text[] end;
$$;
create or replace function public.onebite_access_snapshot(p_actor uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
 'version',1,'revision',(select revision from public.onebite_access_settings),
 'customRoles',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'description',r.description) order by r.created_at,r.id) from public.onebite_roles r where not r.builtin),'[]'::jsonb),
 'users',coalesce((select jsonb_agg(public.onebite_account_json(u.id) order by u.created_at) from public.onebite_users u where public.onebite_has_permission(a.role,'users.manage') or u.id=a.id or (public.onebite_has_permission(a.role,'staff.assign') and u.role<>'Owner' and exists(select 1 from public.onebite_user_sites x join public.onebite_user_sites y on y.site_id=x.site_id where x.user_id=a.id and y.user_id=u.id))),'[]'::jsonb),
 'sites',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'active',s.active,'location',s.location,'latitude',s.latitude,'longitude',s.longitude,'workingHours',s.working_hours,'remarks',s.remarks,'runningFrom',s.running_from,'shutdownOn',s.shutdown_on) order by s.id) from public.onebite_sites s),'[]'::jsonb),
 'grants',(select jsonb_object_agg(r.id,coalesce((select jsonb_agg(p.permission order by p.permission) from public.onebite_role_permissions p where p.role=r.id),'[]'::jsonb)) from public.onebite_roles r),
 'events',case when public.onebite_has_permission(a.role,'users.manage') then coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'time',e.time,'actorId',e.actor_id,'actorName',e.actor_name,'action',e.action,'targetName',e.target_name,'detail',e.detail) order by e.time) from (select * from public.onebite_access_audit order by time desc limit 200)e),'[]'::jsonb) else '[]'::jsonb end)
 from public.onebite_users a where a.id=p_actor and a.active;
$$;
create or replace function public.onebite_access_api(p_action text,p_payload jsonb default '{}'::jsonb,p_session_hash text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 a public.onebite_users; target public.onebite_users; credential public.onebite_credentials;
 site_id integer; site_location text; site_lat double precision; site_lng double precision; site_hours jsonb; site_remarks text; site_start date; site_end date;
 settings public.onebite_access_settings; uid uuid; uname text; full_name text; next_role text; next_active boolean;
 assigned integer[]; old_sites integer[]; actor_sites integer[]; perms text[]; changed_site integer;
 pin text; action_name text; target_name text; detail text; supplied_revision bigint;
begin
 if p_action='bootstrap.status' then return jsonb_build_object('ownerCreated',(select bootstrap_used from public.onebite_access_settings)); end if;
 if p_action='bootstrap' then
  select * into settings from public.onebite_access_settings where id=true for update;
  if settings.bootstrap_used or settings.bootstrap_hash is null or settings.bootstrap_hash is distinct from p_payload->>'bootstrap_hash' then return jsonb_build_object('error','invalid_setup'); end if;
  uname=lower(trim(p_payload->>'username')); full_name=trim(p_payload->>'name'); pin=p_payload->>'pin';
  if uname is null or uname !~ '^[a-z0-9][a-z0-9_.-]{2,31}$' or full_name is null or length(full_name) not between 1 and 100 or pin is null or pin !~ '^[0-9]{6}$' then return jsonb_build_object('error','invalid_account'); end if;
  insert into public.onebite_users(name,username,role) values(full_name,uname,'Owner') returning id into uid;
  insert into public.onebite_credentials(user_id,pin_hash) values(uid,extensions.crypt(pin,extensions.gen_salt('bf',12)));
  insert into public.onebite_sessions(token_hash,user_id) values(p_payload->>'new_session_hash',uid);
  update public.onebite_access_settings set bootstrap_hash=null,bootstrap_used=true,revision=revision+1 where id=true;
  insert into public.onebite_access_audit(actor_id,actor_name,action,target_name,detail) values(uid,full_name,'owner.created',full_name,'First Owner provisioned');
  return jsonb_build_object('actor',public.onebite_account_json(uid),'mustChangePin',false,'state',public.onebite_access_snapshot(uid));
 end if;
 if p_action='login' then
  uname=lower(trim(p_payload->>'username'));pin=p_payload->>'pin';
  select * into a from public.onebite_users where username=uname;
  if not found or not a.active or pin is null or pin !~ '^[0-9]{6}$' then return jsonb_build_object('error','invalid_credentials'); end if;
  select * into credential from public.onebite_credentials where user_id=a.id for update;
  if not found then return jsonb_build_object('error','invalid_credentials');end if;
  if credential.locked_until>now() or credential.last_attempt>now()-interval '1 second' then return jsonb_build_object('error','login_throttled'); end if;
  if credential.pin_hash<>extensions.crypt(pin,credential.pin_hash) then
   update public.onebite_credentials set failures=case when failures>=4 then 0 else failures+1 end,locked_until=case when failures>=4 then now()+interval '15 minutes' else null end,last_attempt=now() where user_id=a.id;
   return jsonb_build_object('error','invalid_credentials');
  end if;
  update public.onebite_credentials set failures=0,locked_until=null,last_attempt=now() where user_id=a.id;
  delete from public.onebite_sessions where expires_at<=now();
  insert into public.onebite_sessions(token_hash,user_id) values(p_payload->>'new_session_hash',a.id);
  return jsonb_build_object('actor',public.onebite_account_json(a.id),'mustChangePin',credential.must_change,'state',public.onebite_access_snapshot(a.id));
 end if;
 select u.* into a from public.onebite_users u join public.onebite_sessions s on s.user_id=u.id where s.token_hash=p_session_hash and s.expires_at>now() and u.active;
 if not found then return jsonb_build_object('error','unauthorized'); end if;
 if p_action='logout' then delete from public.onebite_sessions where token_hash=p_session_hash;return jsonb_build_object('ok',true);end if;
 select * into credential from public.onebite_credentials where user_id=a.id;
 if credential.must_change and p_action not in ('pin.change','me') then return jsonb_build_object('error','pin_change_required'); end if;
 if p_action='me' then return jsonb_build_object('actor',public.onebite_account_json(a.id),'mustChangePin',credential.must_change,'state',public.onebite_access_snapshot(a.id));end if;
 if p_action='pin.change' then
  select * into credential from public.onebite_credentials where user_id=a.id for update;
  if not exists(select 1 from public.onebite_sessions where token_hash=p_session_hash and user_id=a.id and expires_at>now()) then return jsonb_build_object('error','unauthorized');end if;
  if credential.locked_until>now() then return jsonb_build_object('error','login_throttled');end if;
  if (p_payload->>'current_pin') is null or credential.pin_hash<>extensions.crypt(p_payload->>'current_pin',credential.pin_hash) then
   update public.onebite_credentials set failures=case when failures>=4 then 0 else failures+1 end,locked_until=case when failures>=4 then now()+interval '15 minutes' else null end where user_id=a.id;
   return jsonb_build_object('error','invalid_credentials');
  end if;
  pin=p_payload->>'pin';if pin is null or pin !~ '^[0-9]{6}$' or pin=p_payload->>'current_pin' then return jsonb_build_object('error','invalid_pin');end if;
  update public.onebite_credentials set pin_hash=extensions.crypt(pin,extensions.gen_salt('bf',12)),must_change=false,failures=0,locked_until=null where user_id=a.id;
  delete from public.onebite_sessions where user_id=a.id and token_hash<>p_session_hash;
  insert into public.onebite_access_audit(actor_id,actor_name,action,target_name,detail) values(a.id,a.name,'pin.changed',a.name,'PIN changed; other sessions revoked');
  return jsonb_build_object('actor',public.onebite_account_json(a.id),'mustChangePin',false,'state',public.onebite_access_snapshot(a.id));
 end if;
 -- Serialize account/permission writes, refresh actor authorization, and reject stale editors.
 select * into settings from public.onebite_access_settings where id=true for update;
 select u.* into a from public.onebite_users u join public.onebite_sessions s on s.user_id=u.id where s.token_hash=p_session_hash and s.expires_at>now() and u.active;
 if not found then return jsonb_build_object('error','unauthorized');end if;
 -- Module denial overrides saved action grants, including direct API requests.
 if not public.onebite_has_permission(a.role,'admin.access') then return jsonb_build_object('error','forbidden');end if;
 if p_action in ('site.create','site.update') and not public.onebite_has_permission(a.role,'sites.manage') then return jsonb_build_object('error','forbidden');end if;
 if p_action in ('user.create','user.update','pin.reset') and not public.onebite_has_permission(a.role,'users.manage') then return jsonb_build_object('error','forbidden');end if;
 if p_action in ('permissions.update','role.create') and not public.onebite_has_permission(a.role,'roles.manage') then return jsonb_build_object('error','forbidden');end if;
 supplied_revision=(p_payload->>'revision')::bigint;
 if supplied_revision is null or supplied_revision<>settings.revision then return jsonb_build_object('error','stale_revision');end if;
 if p_action in ('user.update','sites.assign','pin.reset') then
  select * into target from public.onebite_users where id=(p_payload->>'id')::uuid;
  if not found then return jsonb_build_object('error','not_found');end if;
  if target.role='Owner' and a.role<>'Owner' then return jsonb_build_object('error','forbidden');end if;
  uid=target.id;target_name=target.name;
 end if;
 if p_action in ('site.create','site.update') then
  full_name=btrim(p_payload->>'name');site_location=btrim(p_payload->>'location');site_remarks=btrim(coalesce(p_payload->>'remarks',''));site_hours=coalesce(p_payload->'workingHours','[]'::jsonb);
  if jsonb_typeof(p_payload->'name') is distinct from 'string' or full_name is null or length(full_name) not between 1 and 100 then return jsonb_build_object('error','invalid_name');end if;
  if jsonb_typeof(p_payload->'location') is distinct from 'string' or site_location is null or length(site_location) not between 1 and 500 then return jsonb_build_object('error','invalid_location');end if;
  if jsonb_typeof(p_payload->'latitude') is distinct from 'number' or jsonb_typeof(p_payload->'longitude') is distinct from 'number' then return jsonb_build_object('error','invalid_coordinates');end if;
  site_lat=(p_payload->>'latitude')::double precision;site_lng=(p_payload->>'longitude')::double precision;
  if not site_lat between -90 and 90 or not site_lng between -180 and 180 then return jsonb_build_object('error','invalid_coordinates');end if;
  if not public.onebite_valid_working_hours(site_hours) then return jsonb_build_object('error','invalid_hours');end if;
  if length(site_remarks)>2000 then return jsonb_build_object('error','invalid_remarks');end if;
  if coalesce(p_payload->>'runningFrom','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (p_payload->>'shutdownOn' is not null and p_payload->>'shutdownOn' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') then return jsonb_build_object('error','invalid_dates');end if;
  begin
   site_start=(p_payload->>'runningFrom')::date;site_end=(p_payload->>'shutdownOn')::date;
  exception when invalid_datetime_format or datetime_field_overflow then return jsonb_build_object('error','invalid_dates');end;
  if not site_start between date '1900-01-01' and date '9999-12-31' or (site_end is not null and (not site_end between date '1900-01-01' and date '9999-12-31' or site_end<site_start)) then return jsonb_build_object('error','invalid_dates');end if;
  if p_action='site.update' then
   if coalesce(p_payload->>'id','') !~ '^[0-9]{1,9}$' then return jsonb_build_object('error','not_found');end if;
   site_id=(p_payload->>'id')::integer;
   if not exists(select 1 from public.onebite_sites where id=site_id) then return jsonb_build_object('error','not_found');end if;
   if jsonb_typeof(p_payload->'active') is distinct from 'boolean' then return jsonb_build_object('error','invalid_site');end if;
   next_active=(p_payload->>'active')::boolean;
  else
   select coalesce(max(id),-1)+1 into site_id from public.onebite_sites;next_active=true;
  end if;
  if exists(select 1 from public.onebite_sites where lower(btrim(name))=lower(full_name) and id<>site_id) then return jsonb_build_object('error','duplicate_site');end if;
  if p_action='site.create' then
   insert into public.onebite_sites(id,name,location,latitude,longitude,working_hours,remarks,running_from,shutdown_on,active) values(site_id,full_name,site_location,site_lat,site_lng,site_hours,site_remarks,site_start,site_end,true);
  else
   update public.onebite_sites set name=full_name,location=site_location,latitude=site_lat,longitude=site_lng,working_hours=site_hours,remarks=site_remarks,running_from=site_start,shutdown_on=site_end,active=next_active where id=site_id;
  end if;
  action_name=case when p_action='site.create' then 'site.created' else 'site.updated' end;target_name=full_name;detail=site_location||' · '||case when next_active then 'active' else 'inactive' end;
 elsif p_action in ('user.create','user.update') then
  uname=lower(trim(p_payload->>'username'));full_name=trim(p_payload->>'name');next_role=p_payload->>'role';next_active=case when p_action='user.create' then true else (p_payload->>'active')::boolean end;
  if uname is null or uname !~ '^[a-z0-9][a-z0-9_.-]{2,31}$' or full_name is null or length(full_name) not between 1 and 100 or next_role is null or not exists(select 1 from public.onebite_roles where id=next_role) or next_active is null then return jsonb_build_object('error','invalid_account');end if;
  if p_action='user.create' and next_role='Owner' then return jsonb_build_object('error','invalid_role');end if;
  if next_role='Owner' and a.role<>'Owner' then return jsonb_build_object('error','forbidden');end if;
  if exists(select 1 from public.onebite_users u where username=uname and (uid is null or u.id<>uid)) then return jsonb_build_object('error','duplicate_username');end if;
  if p_action='user.create' then assigned=array[]::integer[];else
   select coalesce(array_agg(distinct value::integer),array[]::integer[]) into assigned from jsonb_array_elements_text(coalesce(p_payload->'sites','[]'::jsonb));
  end if;
  if exists(select 1 from unnest(assigned)s where not exists(select 1 from public.onebite_sites t where t.id=s)) then return jsonb_build_object('error','invalid_site');end if;
  if next_active and next_role<>'Owner' and not exists(select 1 from public.onebite_sites where id=any(assigned) and active) and not (p_action='user.create' or (cardinality(assigned)=0 and not exists(select 1 from public.onebite_user_sites where user_id=uid))) then return jsonb_build_object('error','site_required');end if;
  if p_action='user.update' and target.active and target.role='Owner' and (not next_active or next_role<>'Owner') and not exists(select 1 from public.onebite_users where id<>uid and active and role='Owner') then return jsonb_build_object('error','last_owner');end if;
  if p_action='user.create' then
   pin=p_payload->>'pin';if pin is null or pin !~ '^[0-9]{6}$' then return jsonb_build_object('error','invalid_pin');end if;
   insert into public.onebite_users(name,username,role,active) values(full_name,uname,next_role,next_active) returning id into uid;
   insert into public.onebite_credentials(user_id,pin_hash,must_change) values(uid,extensions.crypt(pin,extensions.gen_salt('bf',12)),true);
  else
   update public.onebite_users set name=full_name,username=uname,role=next_role,active=next_active,updated_at=now() where id=uid;
   if not next_active or target.role<>next_role then delete from public.onebite_sessions where user_id=uid;end if;
  end if;
  delete from public.onebite_user_sites where user_id=uid;
  insert into public.onebite_user_sites(user_id,site_id) select uid,unnest(assigned);
  target_name=full_name;action_name=p_action;detail=next_role||' · '||case when next_active then 'active' else 'inactive' end;
 elsif p_action='sites.assign' then
  if not public.onebite_has_permission(a.role,'staff.assign') then return jsonb_build_object('error','forbidden');end if;
  select coalesce(array_agg(site_id),array[]::integer[]) into actor_sites from public.onebite_user_sites where user_id=a.id;
  select coalesce(array_agg(site_id),array[]::integer[]) into old_sites from public.onebite_user_sites where user_id=uid;
  select coalesce(array_agg(distinct value::integer),array[]::integer[]) into assigned from jsonb_array_elements_text(coalesce(p_payload->'sites','[]'::jsonb));
  if exists(select 1 from unnest(assigned)s where not exists(select 1 from public.onebite_sites t where t.id=s)) then return jsonb_build_object('error','invalid_site');end if;
  if a.role<>'Owner' then
   if target.role='Owner' or not old_sites&&actor_sites then return jsonb_build_object('error','forbidden');end if;
   for changed_site in select s from unnest(old_sites||assigned)s group by s having bool_or(s=any(old_sites))<>bool_or(s=any(assigned)) loop
    if not changed_site=any(actor_sites) or not exists(select 1 from public.onebite_sites where id=changed_site and active) then return jsonb_build_object('error','forbidden');end if;
   end loop;
  end if;
  if target.active and target.role<>'Owner' and not exists(select 1 from public.onebite_sites where id=any(assigned) and active) then return jsonb_build_object('error','site_required');end if;
  delete from public.onebite_user_sites where user_id=uid;insert into public.onebite_user_sites(user_id,site_id) select uid,unnest(assigned);
  action_name='sites.assigned';detail=array_to_string(assigned,', ');
 elsif p_action in ('permissions.update','role.create') then
  next_role=case when p_action='role.create' then p_payload->>'id' else p_payload->>'role' end;
  if p_action='role.create' then
   full_name=btrim(p_payload->>'name');detail=coalesce(btrim(p_payload->>'description'),'');
   if next_role is null or next_role !~ '^role_[a-f0-9-]{36}$' or exists(select 1 from public.onebite_roles where id=next_role) then return jsonb_build_object('error','invalid_role');end if;
   if full_name is null or length(full_name) not between 1 and 60 then return jsonb_build_object('error','invalid_name');end if;
   if length(detail)>160 then return jsonb_build_object('error','invalid_description');end if;
   if exists(select 1 from public.onebite_roles where lower(btrim(name))=lower(full_name)) then return jsonb_build_object('error','duplicate_role');end if;
  else
   if next_role is null or not exists(select 1 from public.onebite_roles where id=next_role) then return jsonb_build_object('error','invalid_role');end if;
   if next_role='Owner' and a.role<>'Owner' then return jsonb_build_object('error','forbidden');end if;
  end if;
  select coalesce(array_agg(distinct value),array[]::text[]) into perms from jsonb_array_elements_text(coalesce(p_payload->'permissions','[]'::jsonb));
  if exists(select 1 from unnest(perms)p where p not in ('pos.access','admin.access','orders.create','orders.discount','orders.complimentary','orders.cancel_unpaid','orders.qr_reference','shifts.manage','cash.withdraw','staff.assign','users.manage','roles.manage','sites.manage') and (p_action='role.create' or p in ('orders.override','orders.refund') or not exists(select 1 from public.onebite_role_permissions where role=next_role and permission=p))) then return jsonb_build_object('error','permission_ceiling');end if;
  if next_role='Owner' and not array['admin.access','users.manage','roles.manage']<@perms then return jsonb_build_object('error','immutable_grant');end if;
  if p_action='role.create' then
   insert into public.onebite_roles(id,name,description) values(next_role,full_name,detail);
   action_name='role.created';target_name=full_name;
  else
   action_name='permissions.updated';select name into target_name from public.onebite_roles where id=next_role;detail=array_to_string(perms,', ');
  end if;
  delete from public.onebite_role_permissions where role=next_role;insert into public.onebite_role_permissions(role,permission) select next_role,unnest(perms);
  -- Revoke affected sessions, retaining the actor's session after editing their own role.
  delete from public.onebite_sessions where user_id in(select id from public.onebite_users where role=next_role) and token_hash<>p_session_hash;
 elsif p_action='pin.reset' then
  pin=p_payload->>'pin';if pin is null or pin !~ '^[0-9]{6}$' then return jsonb_build_object('error','invalid_pin');end if;
  update public.onebite_credentials set pin_hash=extensions.crypt(pin,extensions.gen_salt('bf',12)),must_change=true,failures=0,locked_until=null,last_attempt=null where user_id=uid;
  delete from public.onebite_sessions where user_id=uid;
  action_name='pin.reset';detail='Temporary PIN set; all sessions revoked';
 else return jsonb_build_object('error','invalid_action');
 end if;
 update public.onebite_access_settings set revision=revision+1 where id=true;
 insert into public.onebite_access_audit(actor_id,actor_name,action,target_name,detail) values(a.id,a.name,action_name,target_name,coalesce(detail,''));
 return jsonb_build_object('ok',true,'state',public.onebite_access_snapshot(a.id));
end;
$$;
