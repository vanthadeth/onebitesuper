-- Uses the existing Owner for authorization; all fixtures and changes roll back.
begin;
do $$
declare owner_id uuid; token text; uname text; reply jsonb; fixture_id uuid; rev bigint; test_pin text='007321';
begin
 select id into owner_id from public.onebite_users where active and role='Owner' limit 1;
 assert owner_id is not null, 'An existing Owner is required';
 token=encode(extensions.gen_random_bytes(32),'hex');uname='test_'||substr(token,1,16);
 insert into public.onebite_sessions(token_hash,user_id) values(token,owner_id);
 select revision into rev from public.onebite_access_settings;
 reply=public.onebite_access_api('user.create',jsonb_build_object('name','Temporary test staff','username',uname,'role','','pin',test_pin,'revision',rev),token);
 assert reply->>'error'='invalid_account', 'A role must be selected';
 reply=public.onebite_access_api('user.create',jsonb_build_object('name','Temporary test staff','username',uname,'role','Owner','pin',test_pin,'revision',rev),token);
 assert reply->>'error'='invalid_role', 'Creation accepts staff roles only';
 reply=public.onebite_access_api('user.create',jsonb_build_object('name','Temporary test staff','username',uname,'role','Cashier','active',false,'sites',jsonb_build_array(1),'pin',test_pin,'revision',rev),token);
 assert reply->>'ok'='true', 'Creation must accept unassigned staff';
 select id into fixture_id from public.onebite_users where username=uname;
 assert (select active from public.onebite_users where id=fixture_id);
 assert not exists(select 1 from public.onebite_user_sites where onebite_user_sites.user_id=fixture_id);
 assert (select must_change and pin_hash=extensions.crypt(test_pin,pin_hash) from public.onebite_credentials where onebite_credentials.user_id=fixture_id);
 select revision into rev from public.onebite_access_settings;
 reply=public.onebite_access_api('user.update',jsonb_build_object('id',fixture_id,'name','Renamed temporary staff','username',uname,'role','Cashier','active',true,'sites','[]'::jsonb,'revision',rev),token);
 assert reply->>'ok'='true', 'An unassigned profile remains editable';
 select revision into rev from public.onebite_access_settings;
 reply=public.onebite_access_api('sites.assign',jsonb_build_object('id',fixture_id,'sites',jsonb_build_array(0),'revision',rev),token);
 assert reply->>'ok'='true', 'Site can be assigned later';
 select revision into rev from public.onebite_access_settings;
 reply=public.onebite_access_api('user.update',jsonb_build_object('id',fixture_id,'name','Renamed temporary staff','username',uname,'role','Cashier','active',true,'sites','[]'::jsonb,'revision',rev),token);
 assert reply->>'error'='site_required', 'Existing assigned staff retain active-site protection';
 assert not has_function_privilege('anon','public.onebite_access_api(text,jsonb,text)','execute');
 assert not has_function_privilege('authenticated','public.onebite_access_api(text,jsonb,text)','execute');
end;
$$;
rollback;
select 'staff creation defaults, PIN hash and later assignment verified; fixtures rolled back' as result;
