-- Exercise actual settings RPC permissions, validation and stale-save handling; fixtures roll back.
begin;
set local role service_role;
do $$
declare owner_id uuid; staff_id uuid; token text:=encode(extensions.gen_random_bytes(32),'hex'); staff_token text:=encode(extensions.gen_random_bytes(32),'hex'); fixture text:=substr(token,1,20); p jsonb; r jsonb; rev bigint;
begin
 perform 1 from public.onebite_access_settings where id=true for update;
 insert into public.onebite_users(name,username,role) values('Settings verification Owner','settings_o_'||fixture,'Owner') returning id into owner_id;
 insert into public.onebite_users(name,username,role) values('Settings verification Staff','settings_s_'||fixture,'Cashier') returning id into staff_id;
 insert into public.onebite_credentials(user_id,pin_hash,must_change) values(owner_id,'transaction-only',false),(staff_id,'transaction-only',false);
 insert into public.onebite_sessions(token_hash,user_id) values(token,owner_id),(staff_token,staff_id);
 p=(select app_settings from public.onebite_access_settings where id=true)||'{"geofenceRadiusM":150,"gpsAccuracyM":25,"exchangeRate":4100}'::jsonb;
 rev=(select revision from public.onebite_access_settings where id=true);
 r=public.onebite_access_api('settings.update',p||jsonb_build_object('revision',rev),token);
 if r ? 'error' or r->'state'->'appSettings' is distinct from p then raise exception 'Owner settings save failed: %',r->>'error';end if;
 if not exists(select 1 from public.onebite_access_audit where actor_id=owner_id and action='settings.updated') then raise exception 'Settings not audited';end if;
 r=public.onebite_access_api('bootstrap.status');if r->'appSettings' is distinct from p or r ? 'actor' then raise exception 'Public defaults response incorrect';end if;
 r=public.onebite_access_api('settings.update',p||jsonb_build_object('revision',rev),token);
 if r->>'error' is distinct from 'stale_revision' then raise exception 'Stale settings allowed';end if;
 for p in select v from (values
  ('{"defaultLanguage":null}'::jsonb),('{"defaultTheme":"system"}'::jsonb),('{"defaultCurrency":"EUR"}'::jsonb),('{"defaultPaymentMethod":"card"}'::jsonb),('{"geofenceRadiusM":0}'::jsonb),('{"gpsAccuracyM":50.5}'::jsonb),('{"exchangeRate":0}'::jsonb),('{"secret":"not allowed"}'::jsonb)
 ) bad(v) loop
  r=public.onebite_access_api('settings.update',(select app_settings from public.onebite_access_settings where id=true)||p||jsonb_build_object('revision',(select revision from public.onebite_access_settings where id=true)),token);
  if r->>'error' is distinct from 'invalid_settings' then raise exception 'Invalid settings allowed: %',p;end if;
 end loop;
 p=(select app_settings from public.onebite_access_settings where id=true);
 if public.onebite_valid_app_settings(p-'exchangeRate') or public.onebite_valid_app_settings(p||'{"defaultLanguage":null}') is distinct from false then raise exception 'Incomplete settings accepted';end if;
 delete from public.onebite_role_permissions where role='Cashier' and permission in ('settings.manage','admin.access');
 insert into public.onebite_role_permissions(role,permission) values('Cashier','admin.access');
 r=public.onebite_access_api('settings.update',p||jsonb_build_object('revision',(select revision from public.onebite_access_settings where id=true)),staff_token);
 if r->>'error' is distinct from 'forbidden' then raise exception 'Unauthorized settings write allowed';end if;
 insert into public.onebite_role_permissions(role,permission) values('Cashier','settings.manage');
 r=public.onebite_access_api('settings.update',p||jsonb_build_object('revision',(select revision from public.onebite_access_settings where id=true)),staff_token);
 if r ? 'error' then raise exception 'Delegated settings save failed';end if;
 delete from public.onebite_role_permissions where role='Cashier' and permission='admin.access';
 r=public.onebite_access_api('settings.update',p||jsonb_build_object('revision',(select revision from public.onebite_access_settings where id=true)),staff_token);
 if r->>'error' is distinct from 'forbidden' then raise exception 'Denied module allowed settings write';end if;
end $$;
rollback;
select 'app settings verification passed' as result;
