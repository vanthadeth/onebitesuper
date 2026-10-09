-- Regression checks through the actual RPC as service_role. All fixtures roll back.
begin;
set local role service_role;
do $$
declare
 owner_id uuid; staff_id uuid; supervisor_id uuid; fixture text:=substr(encode(extensions.gen_random_bytes(16),'hex'),1,20);
 owner_token text:=encode(extensions.gen_random_bytes(32),'hex'); supervisor_token text:=encode(extensions.gen_random_bytes(32),'hex');
 s1 integer; s2 integer; s3 integer; r jsonb; rev bigint;
begin
 perform 1 from public.onebite_access_settings where id=true for update;
 select coalesce(max(id),-1)+1 into s1 from public.onebite_sites; s2=s1+1;s3=s1+2;
 insert into public.onebite_sites(id,name,active) values(s1,'Verify assignment 1 '||fixture,true),(s2,'Verify assignment 2 '||fixture,true),(s3,'Verify assignment 3 '||fixture,true);
 insert into public.onebite_users(name,username,role) values('Verify Owner','verify_o_'||fixture,'Owner') returning id into owner_id;
 insert into public.onebite_users(name,username,role) values('Verify Staff','verify_u_'||fixture,'Cashier') returning id into staff_id;
 insert into public.onebite_users(name,username,role) values('Verify Supervisor','verify_s_'||fixture,'Supervisor') returning id into supervisor_id;
 insert into public.onebite_credentials(user_id,pin_hash,must_change) values(owner_id,'transaction-only',false),(staff_id,'transaction-only',false),(supervisor_id,'transaction-only',false);
 insert into public.onebite_sessions(token_hash,user_id) values(owner_token,owner_id),(supervisor_token,supervisor_id);
 insert into public.onebite_role_permissions(role,permission) values('Owner','staff.assign'),('Supervisor','staff.assign'),('Supervisor','admin.access') on conflict do nothing;
 -- First assignment to a new, active, unassigned user; duplicate IDs are normalized.
 rev=(select revision from public.onebite_access_settings where id=true);
 r=public.onebite_access_api('sites.assign',jsonb_build_object('id',staff_id,'sites',jsonb_build_array(s1,s1,s3),'revision',rev),owner_token);
 if r ? 'error' or (select count(*) from public.onebite_user_sites where user_id=staff_id)<>2 then raise exception 'Owner first assignment failed: %',r->>'error';end if;
 if not exists(select 1 from jsonb_array_elements(r->'state'->'users') u where u->>'id'=staff_id::text and u->'sites' @> jsonb_build_array(s1,s3)) then raise exception 'Snapshot missing assignment';end if;
 if not exists(select 1 from public.onebite_access_audit where actor_id=owner_id and action='sites.assigned' and target_name='Verify Staff') then raise exception 'Assignment not audited';end if;
 r=public.onebite_access_api('sites.assign',jsonb_build_object('id',staff_id,'sites',jsonb_build_array(s2),'revision',rev),owner_token);
 if r->>'error' is distinct from 'stale_revision' then raise exception 'Stale assignment allowed';end if;
 -- Supervisor can change their own sites and must preserve outside sites.
 insert into public.onebite_user_sites(user_id,site_id) values(supervisor_id,s1),(supervisor_id,s2);
 r=public.onebite_access_api('sites.assign',jsonb_build_object('id',staff_id,'sites',jsonb_build_array(s2,s3),'revision',(select revision from public.onebite_access_settings where id=true)),supervisor_token);
 if r ? 'error' or not exists(select 1 from public.onebite_user_sites where user_id=staff_id and site_id=s3) or exists(select 1 from public.onebite_user_sites where user_id=staff_id and site_id=s1) then raise exception 'Scoped supervisor assignment failed: %',r->>'error';end if;
 r=public.onebite_access_api('sites.assign',jsonb_build_object('id',staff_id,'sites',jsonb_build_array(s2),'revision',(select revision from public.onebite_access_settings where id=true)),supervisor_token);
 if r->>'error' is distinct from 'forbidden' then raise exception 'Supervisor removed outside site';end if;
 -- Missing permission and denied module must block the write.
 delete from public.onebite_role_permissions where role='Supervisor' and permission='staff.assign';
 r=public.onebite_access_api('sites.assign',jsonb_build_object('id',staff_id,'sites',jsonb_build_array(s2,s3),'revision',(select revision from public.onebite_access_settings where id=true)),supervisor_token);
 if r->>'error' is distinct from 'forbidden' then raise exception 'Missing action permission allowed';end if;
 insert into public.onebite_role_permissions(role,permission) values('Supervisor','staff.assign');
 delete from public.onebite_role_permissions where role='Supervisor' and permission='admin.access';
 r=public.onebite_access_api('sites.assign',jsonb_build_object('id',staff_id,'sites',jsonb_build_array(s2,s3),'revision',(select revision from public.onebite_access_settings where id=true)),supervisor_token);
 if r->>'error' is distinct from 'forbidden' then raise exception 'Denied module allowed';end if;
 -- Active staff cannot lose every active site; Owner can replace the entire assignment.
 r=public.onebite_access_api('sites.assign',jsonb_build_object('id',staff_id,'sites','[]'::jsonb,'revision',(select revision from public.onebite_access_settings where id=true)),owner_token);
 if r->>'error' is distinct from 'site_required' then raise exception 'Empty active assignment allowed';end if;
 r=public.onebite_access_api('sites.assign',jsonb_build_object('id',staff_id,'sites',jsonb_build_array(s1),'revision',(select revision from public.onebite_access_settings where id=true)),owner_token);
 if r ? 'error' or (select count(*) from public.onebite_user_sites where user_id=staff_id)<>1 or not exists(select 1 from public.onebite_user_sites where user_id=staff_id and site_id=s1) then raise exception 'Owner replacement failed: %',r->>'error';end if;
 if has_table_privilege('anon','public.onebite_user_sites','INSERT') or has_function_privilege('anon','public.onebite_access_api(text,jsonb,text)','EXECUTE') then raise exception 'Public access exposed';end if;
end;
$$;
rollback;
