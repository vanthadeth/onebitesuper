-- Safe against an existing Owner database: every fixture and change rolls back.
begin;
do $$
declare supervisor_id uuid; cashier_id uuid; token text; rev bigint; reply jsonb;
begin
 token=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.onebite_users(name,username,role) values('Permission test supervisor','test_'||substr(token,1,16),'Supervisor') returning id into supervisor_id;
 insert into public.onebite_users(name,username,role) values('Permission test cashier','test_'||substr(token,17,16),'Cashier') returning id into cashier_id;
 insert into public.onebite_user_sites(user_id,site_id) values(supervisor_id,0),(supervisor_id,1),(cashier_id,0);
 insert into public.onebite_credentials(user_id,pin_hash) values(supervisor_id,extensions.crypt(token,extensions.gen_salt('bf',4)));
 insert into public.onebite_sessions(token_hash,user_id) values(token,supervisor_id);
 select revision into rev from public.onebite_access_settings;
 assert public.onebite_has_permission('Supervisor','staff.assign');
 delete from public.onebite_role_permissions where role='Supervisor' and permission in ('admin.access','pos.access');
 assert not public.onebite_has_permission('Supervisor','staff.assign');
 assert not public.onebite_has_permission('Supervisor','orders.create');
 assert exists(select 1 from public.onebite_role_permissions where role='Supervisor' and permission='staff.assign');
 assert jsonb_array_length(public.onebite_access_snapshot(supervisor_id)->'users')=1;
 reply=public.onebite_access_api('sites.assign',jsonb_build_object('revision',rev,'id',cashier_id,'sites',jsonb_build_array(0,1)),token);
 assert reply->>'error'='forbidden', 'Module gate must deny direct requests';
 insert into public.onebite_role_permissions(role,permission) values('Supervisor','admin.access'),('Supervisor','pos.access');
 assert public.onebite_has_permission('Supervisor','orders.create');
 delete from public.onebite_role_permissions where role='Supervisor' and permission='staff.assign';
 reply=public.onebite_access_api('sites.assign',jsonb_build_object('revision',rev,'id',cashier_id,'sites',jsonb_build_array(0,1)),token);
 assert reply->>'error'='forbidden', 'Action denial must apply with module allowed';
 insert into public.onebite_role_permissions(role,permission) values('Supervisor','staff.assign');
 reply=public.onebite_access_api('sites.assign',jsonb_build_object('revision',rev,'id',cashier_id,'sites',jsonb_build_array(0,1)),token);
 assert reply->>'ok'='true', 'Restoring module and action must restore scoped assignment';
 assert not public.onebite_has_permission('Cashier','inventory.access');
 assert not public.onebite_has_permission('Owner','orders.refund');
 assert not public.onebite_has_permission('Owner','orders.override');
 assert not has_function_privilege('anon','public.onebite_has_permission(text,text)','execute');
 assert not has_function_privilege('authenticated','public.onebite_has_permission(text,text)','execute');
 assert has_function_privilege('service_role','public.onebite_has_permission(text,text)','execute');
end;
$$;
rollback;
select 'module and action enforcement passed; fixtures rolled back' as result;
