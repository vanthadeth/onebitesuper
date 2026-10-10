-- Seven-day fixed lifetime, Owner-only MFA. Keep authorization and revocation checks.
alter table public.onebite_sessions alter column expires_at set default now()+interval '7 days';
-- Extend only sessions that are still valid; never revive expired or revoked tokens.
update public.onebite_sessions set expires_at=created_at+interval '7 days' where expires_at>now() and created_at+interval '7 days'>now();

create or replace function public.onebite_session_guard(p_hash text,p_sensitive boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.onebite_users%rowtype;s public.onebite_sessions%rowtype;c public.onebite_credentials%rowtype;
begin
 select * into s from public.onebite_sessions where token_hash=p_hash for update;
 if not found or s.expires_at<=now() then
  delete from public.onebite_sessions where token_hash=p_hash;return jsonb_build_object('error','unauthorized');end if;
 select * into a from public.onebite_users where id=s.user_id and active;
 if not found then return jsonb_build_object('error','unauthorized');end if;
 select * into c from public.onebite_credentials where user_id=a.id;
 if c.must_change then return jsonb_build_object('error','pin_change_required');end if;
 if a.role='Owner' and s.mfa_at is null then return jsonb_build_object('error','mfa_required');end if;
 if p_sensitive and a.role='Owner' and s.mfa_at<now()-interval '5 minutes' then return jsonb_build_object('error','reauth_required');end if;
 update public.onebite_sessions set last_seen=now() where token_hash=p_hash;
 return jsonb_build_object('actor',public.onebite_account_json(a.id));
end $$;

create or replace function public.onebite_access_api(p_action text,p_payload jsonb default '{}'::jsonb,p_session_hash text default null) returns jsonb
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
   privileged=(r->'actor'->>'role')='Owner';
   select * into s from public.onebite_sessions where token_hash=p_payload->>'new_session_hash';
   r=r||jsonb_build_object('sessionExpiresAt',extract(epoch from s.expires_at)*1000);
   if c.must_change or privileged then
    return jsonb_build_object('actor',r->'actor','mustChangePin',c.must_change,'mfaRequired',privileged,'mfaEnrollment',c.totp_counter<0,'sessionExpiresAt',extract(epoch from s.expires_at)*1000);end if;
  end if;
  return r;
 end if;
 select * into s from public.onebite_sessions where token_hash=p_session_hash for update;
 if not found or s.expires_at<=now() then
  delete from public.onebite_sessions where token_hash=p_session_hash;return jsonb_build_object('error','unauthorized');end if;
 select * into a from public.onebite_users where id=s.user_id and active;
 if not found then return jsonb_build_object('error','unauthorized');end if;
 select * into c from public.onebite_credentials where user_id=a.id for update;
 privileged=a.role='Owner';
 if p_action='logout' then
  delete from public.onebite_sessions where token_hash=p_session_hash;
  insert into public.onebite_security_events(actor_id,action,outcome,request_id) values(a.id,'logout','revoked',request_id);
  return jsonb_build_object('ok',true);end if;
 if p_action='me' and (c.must_change or (privileged and s.mfa_at is null)) then
  return jsonb_build_object('actor',public.onebite_account_json(a.id),'mustChangePin',c.must_change,'mfaRequired',privileged,'mfaEnrollment',c.totp_counter<0,'sessionExpiresAt',extract(epoch from s.expires_at)*1000);end if;
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
   if c.must_change then return jsonb_build_object('actor',public.onebite_account_json(a.id),'mustChangePin',true,'sessionExpiresAt',extract(epoch from s.expires_at)*1000);end if;
   return jsonb_build_object('actor',public.onebite_account_json(a.id),'state',public.onebite_access_snapshot(a.id),'sessionExpiresAt',extract(epoch from s.expires_at)*1000);
  end if;
 end if;
 if p_action='pin.change' then
  if privileged and c.totp_counter>=0 and s.mfa_at is null then return jsonb_build_object('error','mfa_required');end if;
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
  return jsonb_build_object('actor',r->'actor','mustChangePin',false,'mfaRequired',true,'mfaEnrollment',c.totp_counter<0,'sessionExpiresAt',extract(epoch from s.expires_at)*1000);end if;
 if p_action='me' or p_action='pin.change' then r=r||jsonb_build_object('sessionExpiresAt',extract(epoch from s.expires_at)*1000);update public.onebite_sessions set last_seen=now() where token_hash=p_session_hash;end if;
 insert into public.onebite_security_events(actor_id,action,outcome,request_id) values(a.id,p_action,'allowed',request_id);
 if not exists(select 1 from public.onebite_sessions where token_hash=p_session_hash) then r=r-'state';end if;
 return r;
end $$;

create or replace function public.onebite_security_maintenance() returns void language plpgsql security invoker set search_path='' as $$
begin
 delete from public.onebite_sessions where expires_at<now();
 delete from public.onebite_request_limits where window_start<now()-interval '1 day';
 delete from public.onebite_security_events where time<now()-interval '365 days';
end $$;

-- Replacement preserves existing service-only ACLs.
revoke execute on function public.onebite_session_guard(text,boolean),public.onebite_access_api(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.onebite_session_guard(text,boolean),public.onebite_access_api(text,jsonb,text) to service_role;
revoke execute on function public.onebite_security_maintenance() from public,anon,authenticated,service_role;
