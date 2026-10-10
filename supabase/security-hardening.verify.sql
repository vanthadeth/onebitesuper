-- Run only against an isolated database. All fixtures roll back.
begin;
create function pg_temp.assert_true(v boolean,msg text) returns void language plpgsql as $$begin if v is distinct from true then raise exception 'Security check failed: %',msg;end if;end $$;
insert into public.onebite_users(id,name,username,role,active) values
 ('10000000-0000-4000-8000-000000000001','Test Owner','security.owner','Owner',true),
 ('10000000-0000-4000-8000-000000000002','Delegated','security.delegated','Supervisor',true),
 ('10000000-0000-4000-8000-000000000003','Temporary','security.temporary','Cashier',true),
 ('10000000-0000-4000-8000-000000000004','Cashier','security.cashier','Cashier',true);
insert into public.onebite_credentials(user_id,pin_hash,must_change,totp_secret,totp_counter) select id,extensions.crypt('739284',extensions.gen_salt('bf',4)),username='security.temporary',case when role in ('Owner','Supervisor') then repeat('A',32) else null end,case when role in ('Owner','Supervisor') then 0 else -1 end from public.onebite_users;
insert into public.onebite_user_sites(user_id,site_id) values('10000000-0000-4000-8000-000000000004',0);
update public.onebite_sites set remarks='Private business details';
insert into public.onebite_role_permissions(role,permission) values('Supervisor','roles.manage'),('Supervisor','users.manage') on conflict do nothing;
insert into public.onebite_sessions(token_hash,user_id,mfa_at) select repeat(right(id::text,1),64),id,case when role='Owner' then now() else null end from public.onebite_users;
select pg_temp.assert_true((select bool_and(expires_at=created_at+interval '7 days') from public.onebite_sessions),'sessions default to seven days');
set local role service_role;
select pg_temp.assert_true(public.onebite_access_api('login',jsonb_build_object('username','security.delegated','pin','739284','new_session_hash',repeat('c',64))) ? 'state','delegated manager signs in using PIN only');
select pg_temp.assert_true(public.onebite_access_api('me','{}',repeat('2',64)) ? 'state','previously MFA-enrolled staff no longer need authenticator');
select pg_temp.assert_true(public.onebite_access_api('permissions.update',jsonb_build_object('role','Supervisor','permissions',jsonb_build_array('admin.access','roles.manage','settings.manage'),'revision',0),repeat('2',64))->>'error'='forbidden','delegated role escalation denied');
select pg_temp.assert_true(public.onebite_access_api('pin.reset',jsonb_build_object('id','10000000-0000-4000-8000-000000000001','pin','739285','revision',0),repeat('2',64))->>'error'='forbidden','privileged PIN reset denied');
select pg_temp.assert_true(not public.onebite_access_api('me','{}',repeat('3',64)) ? 'state','temporary credential has no snapshot');
select pg_temp.assert_true(public.onebite_access_api('me','{}',repeat('3',64))->>'mustChangePin'='true','temporary credential challenge returned');
select pg_temp.assert_true(jsonb_array_length(public.onebite_access_api('me','{}',repeat('4',64))->'state'->'sites')=1,'site assignment scopes reads');
select pg_temp.assert_true(public.onebite_access_api('me','{}',repeat('4',64))->'state'->'sites'->0->>'remarks'='','private site remarks hidden');
select pg_temp.assert_true(not public.onebite_valid_pin('123456') and not public.onebite_valid_pin('000000') and public.onebite_valid_pin('739284'),'common PIN rejection');
select pg_temp.assert_true(not has_function_privilege('anon','public.onebite_access_api(text,jsonb,text)','EXECUTE'),'anon API denied');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.onebite_security_events','SELECT'),'browser audit table denied');
reset role;
update public.onebite_sessions set mfa_at=null where token_hash=repeat('1',64);
set local role service_role;
select pg_temp.assert_true(not public.onebite_access_api('me','{}',repeat('1',64)) ? 'state','MFA pending has no snapshot');
select pg_temp.assert_true(public.onebite_access_api('settings.update','{"revision":0}',repeat('1',64))->>'error'='mfa_required','MFA cannot be bypassed by direct mutation');
select pg_temp.assert_true(public.onebite_activity_page('{}',repeat('1',64))->>'error'='mfa_required','paged activity shares MFA guard');
select pg_temp.assert_true(public.onebite_access_api('mfa.confirm','{"counter":1}',repeat('1',64)) ? 'state','verified MFA opens session');
select pg_temp.assert_true(public.onebite_access_api('mfa.confirm','{"counter":1}',repeat('1',64))->>'error'='invalid_mfa','MFA replay rejected');
reset role;
update public.onebite_sessions set mfa_at=now()-interval '6 minutes' where token_hash=repeat('1',64);
set local role service_role;
select pg_temp.assert_true(public.onebite_access_api('settings.update','{"revision":0}',repeat('1',64))->>'error'='reauth_required','sensitive operation needs recent MFA');
reset role;
update public.onebite_sessions set created_at=now()-interval '6 days',last_seen=now()-interval '6 days',expires_at=now()+interval '1 day' where token_hash=repeat('1',64);
select public.onebite_security_maintenance();
select pg_temp.assert_true(exists(select 1 from public.onebite_sessions where token_hash=repeat('1',64)),'maintenance retains valid idle sessions');
set local role service_role;
select pg_temp.assert_true(public.onebite_access_api('me','{}',repeat('1',64)) ? 'state','six-day inactivity does not invalidate session');
select pg_temp.assert_true((public.onebite_access_api('me','{}',repeat('1',64))->>'sessionExpiresAt')::numeric=extract(epoch from now()+interval '1 day')*1000,'server returns fixed absolute expiry');
reset role;
update public.onebite_sessions set expires_at=now()-interval '1 second' where token_hash=repeat('1',64);
set local role service_role;
select pg_temp.assert_true(public.onebite_access_api('me','{}',repeat('1',64))->>'error'='unauthorized','expired session invalidated');
select pg_temp.assert_true(public.onebite_rate_limit('fixture-limit',1,60) and not public.onebite_rate_limit('fixture-limit',1,60),'atomic limiter caps requests');
reset role;
select pg_temp.assert_true(exists(select 1 from public.onebite_security_events where action='mfa.verify' and outcome='rejected'),'MFA rejection audited');
rollback;
