-- Module gates preserve existing action grants and Owner recovery access.
create or replace function public.onebite_permission_ceiling(p_role text) returns text[] language sql immutable set search_path='' as $$
 select case p_role
 when 'Owner' then array['pos.access','attendance.access','inventory.access','admin.access','orders.create','orders.discount','orders.complimentary','orders.cancel_unpaid','orders.qr_reference','shifts.manage','cash.withdraw','staff.assign','users.manage','roles.manage','sites.manage','catalog.manage','rules.manage']
 when 'Supervisor' then array['pos.access','attendance.access','inventory.access','admin.access','orders.create','orders.discount','orders.complimentary','orders.cancel_unpaid','orders.qr_reference','shifts.manage','cash.withdraw','staff.assign']
 when 'Cashier' then array['pos.access','attendance.access','admin.access','orders.create','orders.discount','orders.complimentary','orders.cancel_unpaid','orders.qr_reference','shifts.manage']
 else array[]::text[] end;
$$;
create or replace function public.onebite_has_permission(p_role text,p_permission text) returns boolean language sql stable security invoker set search_path='' as $$
 select p_permission=any(public.onebite_permission_ceiling(p_role))
 and exists(select 1 from public.onebite_role_permissions where role=p_role and permission=p_permission)
 and exists(select 1 from public.onebite_role_permissions where role=p_role and permission=case
  when p_permission in ('pos.access','orders.create','orders.discount','orders.complimentary','orders.cancel_unpaid','orders.qr_reference','shifts.manage','cash.withdraw') then 'pos.access'
  when p_permission='attendance.access' then 'attendance.access'
  when p_permission='inventory.access' then 'inventory.access'
  when p_permission in ('admin.access','staff.assign','users.manage','roles.manage','sites.manage','catalog.manage','rules.manage') then 'admin.access'
  else null end);
$$;
insert into public.onebite_role_permissions(role,permission)
 select r,p from unnest(array['Owner','Supervisor','Cashier'])r
 cross join lateral unnest(public.onebite_permission_ceiling(r))p
 where p like '%.access' on conflict do nothing;
update public.onebite_access_settings set revision=revision+1 where id=true;
create or replace function public.onebite_access_snapshot(p_actor uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('version',1,'revision',(select revision from public.onebite_access_settings),'users',coalesce((select jsonb_agg(public.onebite_account_json(u.id) order by u.created_at) from public.onebite_users u where a.role='Owner' or u.id=a.id or (a.role='Supervisor' and public.onebite_has_permission(a.role,'staff.assign') and u.role='Cashier' and exists(select 1 from public.onebite_user_sites x join public.onebite_user_sites y on y.site_id=x.site_id where x.user_id=a.id and y.user_id=u.id))),'[]'::jsonb),'sites',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'active',s.active) order by s.id) from public.onebite_sites s),'[]'::jsonb),'grants',(select jsonb_object_agg(r,coalesce((select jsonb_agg(p.permission order by p.permission) from public.onebite_role_permissions p where p.role=r),'[]'::jsonb)) from unnest(array['Owner','Supervisor','Cashier'])r),'events',case when a.role='Owner' then coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'time',e.time,'actorId',e.actor_id,'actorName',e.actor_name,'action',e.action,'targetName',e.target_name,'detail',e.detail) order by e.time) from (select * from public.onebite_access_audit order by time desc limit 200)e),'[]'::jsonb) else '[]'::jsonb end) from public.onebite_users a where a.id=p_actor and a.active;
$$;
create or replace function public.onebite_access_api(p_action text,p_payload jsonb default '{}'::jsonb,p_session_hash text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 a public.onebite_users; target public.onebite_users; credential public.onebite_credentials;
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
 if p_action in ('user.create','user.update','pin.reset') and not public.onebite_has_permission(a.role,'users.manage') then return jsonb_build_object('error','forbidden');end if;
 if p_action='permissions.update' and not public.onebite_has_permission(a.role,'roles.manage') then return jsonb_build_object('error','forbidden');end if;
 supplied_revision=(p_payload->>'revision')::bigint;
 if supplied_revision is null or supplied_revision<>settings.revision then return jsonb_build_object('error','stale_revision');end if;
 if p_action in ('user.create','user.update','pin.reset') and a.role<>'Owner' then return jsonb_build_object('error','forbidden');end if;
 if p_action in ('user.update','sites.assign','pin.reset') then
  select * into target from public.onebite_users where id=(p_payload->>'id')::uuid;
  if not found then return jsonb_build_object('error','not_found');end if;
  uid=target.id;target_name=target.name;
 end if;
 if p_action in ('user.create','user.update') then
  uname=lower(trim(p_payload->>'username'));full_name=trim(p_payload->>'name');next_role=p_payload->>'role';next_active=(p_payload->>'active')::boolean;
  if uname is null or uname !~ '^[a-z0-9][a-z0-9_.-]{2,31}$' or full_name is null or length(full_name) not between 1 and 100 or next_role is null or next_role not in ('Owner','Supervisor','Cashier') or next_active is null then return jsonb_build_object('error','invalid_account');end if;
  if exists(select 1 from public.onebite_users u where username=uname and (uid is null or u.id<>uid)) then return jsonb_build_object('error','duplicate_username');end if;
  select coalesce(array_agg(distinct value::integer),array[]::integer[]) into assigned from jsonb_array_elements_text(coalesce(p_payload->'sites','[]'::jsonb));
  if exists(select 1 from unnest(assigned)s where not exists(select 1 from public.onebite_sites t where t.id=s)) then return jsonb_build_object('error','invalid_site');end if;
  if next_active and next_role<>'Owner' and not exists(select 1 from public.onebite_sites where id=any(assigned) and active) then return jsonb_build_object('error','site_required');end if;
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
  if a.role not in ('Owner','Supervisor') or not public.onebite_has_permission(a.role,'staff.assign') then return jsonb_build_object('error','forbidden');end if;
  select coalesce(array_agg(site_id),array[]::integer[]) into actor_sites from public.onebite_user_sites where user_id=a.id;
  select coalesce(array_agg(site_id),array[]::integer[]) into old_sites from public.onebite_user_sites where user_id=uid;
  select coalesce(array_agg(distinct value::integer),array[]::integer[]) into assigned from jsonb_array_elements_text(coalesce(p_payload->'sites','[]'::jsonb));
  if exists(select 1 from unnest(assigned)s where not exists(select 1 from public.onebite_sites t where t.id=s)) then return jsonb_build_object('error','invalid_site');end if;
  if a.role='Supervisor' then
   if target.role<>'Cashier' or not old_sites&&actor_sites then return jsonb_build_object('error','forbidden');end if;
   for changed_site in select s from unnest(old_sites||assigned)s group by s having bool_or(s=any(old_sites))<>bool_or(s=any(assigned)) loop
    if not changed_site=any(actor_sites) or not exists(select 1 from public.onebite_sites where id=changed_site and active) then return jsonb_build_object('error','forbidden');end if;
   end loop;
  end if;
  if target.active and target.role<>'Owner' and not exists(select 1 from public.onebite_sites where id=any(assigned) and active) then return jsonb_build_object('error','site_required');end if;
  delete from public.onebite_user_sites where user_id=uid;insert into public.onebite_user_sites(user_id,site_id) select uid,unnest(assigned);
  action_name='sites.assigned';detail=array_to_string(assigned,', ');
 elsif p_action='permissions.update' then
  if a.role<>'Owner' then return jsonb_build_object('error','forbidden');end if;
  next_role=p_payload->>'role';
  if next_role is null or next_role not in ('Cashier','Supervisor') then return jsonb_build_object('error','immutable_grant');end if;
  select coalesce(array_agg(distinct value),array[]::text[]) into perms from jsonb_array_elements_text(coalesce(p_payload->'permissions','[]'::jsonb));
  if not perms<@public.onebite_permission_ceiling(next_role) then return jsonb_build_object('error','permission_ceiling');end if;
  delete from public.onebite_role_permissions where role=next_role;insert into public.onebite_role_permissions(role,permission) select next_role,unnest(perms);
  -- Prevent stale privilege use after role policy changes.
  delete from public.onebite_sessions where user_id in(select id from public.onebite_users where role=next_role);
  action_name='permissions.updated';target_name=next_role;detail=array_to_string(perms,', ');
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
revoke execute on function public.onebite_has_permission(text,text) from public,anon,authenticated;
grant execute on function public.onebite_has_permission(text,text) to service_role;
