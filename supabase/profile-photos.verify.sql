begin;
set local role service_role;
do $$
declare staff uuid;owner_id uuid;token text:=encode(extensions.gen_random_bytes(32),'hex');owner_token text:=encode(extensions.gen_random_bytes(32),'hex');path text;other_path text;r jsonb;p jsonb;v bigint;
begin
 if (select public from storage.buckets where id='profile-photos') is distinct from false then raise exception 'Profile photos are not private';end if;
 if has_function_privilege('anon','public.onebite_profile_photo_api(text,jsonb,text)','execute') or has_function_privilege('authenticated','public.onebite_profile_photo_api(text,jsonb,text)','execute') then raise exception 'Client roles can bypass Edge';end if;
 insert into public.onebite_users(name,username,role) values('Photo Staff','photo_'||substr(replace(gen_random_uuid()::text,'-',''),1,20),'Cashier') returning id into staff;
 insert into public.onebite_users(name,username,role) values('Photo Owner','photo_'||substr(replace(gen_random_uuid()::text,'-',''),1,20),'Owner') returning id into owner_id;
 insert into public.onebite_credentials(user_id,pin_hash,must_change) values(staff,'fixture-only',false),(owner_id,'fixture-only',false);
 insert into public.onebite_sessions(token_hash,user_id) values(token,staff),(owner_token,owner_id);
 -- Self-service never requires user-management permission or staff MFA.
 delete from public.onebite_role_permissions where role='Cashier' and permission in ('admin.access','users.manage');
 r=public.onebite_profile_photo_api('authorize','{}',token);if r->'actor'->>'id' is distinct from staff::text then raise exception 'Staff upload authorization failed: %',r;end if;
 r=public.onebite_profile_photo_api('authorize','{}',owner_token);if r->>'error' is distinct from 'mfa_required' then raise exception 'Owner verification bypassed';end if;
 update public.onebite_sessions set mfa_at=now() where token_hash=owner_token;
 r=public.onebite_profile_photo_api('authorize','{}',owner_token);if r ? 'error' then raise exception 'Verified Owner cannot upload';end if;
 path=staff::text||'/'||gen_random_uuid()||'.jpg';other_path=owner_id::text||'/'||gen_random_uuid()||'.jpg';
 insert into storage.objects(bucket_id,name) values('profile-photos',path),('profile-photos',other_path);
 select revision into v from public.onebite_access_settings where id=true;
 p=jsonb_build_object('id',staff,'photoPath',path,'revision',v);
 r=public.onebite_profile_photo_api('update',p||jsonb_build_object('id',owner_id),token);if r->>'error' is distinct from 'forbidden' then raise exception 'Cross-user update allowed';end if;
 r=public.onebite_profile_photo_api('update',p||jsonb_build_object('photoPath',other_path),token);if r->>'error' is distinct from 'invalid_photo' then raise exception 'Foreign photo allowed';end if;
 r=public.onebite_profile_photo_api('update',p,token);if r ? 'error' or r->'actor'->>'photoPath' is distinct from path then raise exception 'Photo save failed: %',r;end if;
 if not exists(select 1 from jsonb_array_elements(r->'state'->'users') u where u->>'id'=staff::text and u->>'photoPath'=path) then raise exception 'Photo not in snapshot';end if;
 r=public.onebite_profile_photo_api('update',p,token);if r->>'error' is distinct from 'stale_revision' then raise exception 'Stale save allowed';end if;
 r=public.onebite_profile_photo_api('read',jsonb_build_object('id',owner_id),token);if r->>'error' is distinct from 'forbidden' then raise exception 'Cross-user read allowed';end if;
 r=public.onebite_profile_photo_api('read','{}',token);if r->>'photoPath' is distinct from path then raise exception 'Own photo read failed';end if;
 r=public.onebite_profile_photo_api('read',jsonb_build_object('id',staff),owner_token);if r->>'photoPath' is distinct from path then raise exception 'Owner cannot read visible staff photo';end if;
 r=public.onebite_profile_photo_api('update',jsonb_build_object('photoPath',null,'revision',v+1),token);if r ? 'error' or (select photo_path from public.onebite_users where id=staff) is not null then raise exception 'Removal failed: %',r;end if;
 update public.onebite_credentials set must_change=true where user_id=staff;
 r=public.onebite_profile_photo_api('authorize','{}',token);if r->>'error' is distinct from 'pin_change_required' then raise exception 'Required PIN bypassed';end if;
 update public.onebite_credentials set must_change=false where user_id=staff;
 update public.onebite_users set active=false where id=staff;
 r=public.onebite_profile_photo_api('read','{}',token);if r->>'error' is distinct from 'unauthorized' then raise exception 'Inactive account read allowed';end if;
 delete from public.onebite_sessions where token_hash=owner_token;
 r=public.onebite_profile_photo_api('authorize','{}',owner_token);if r->>'error' is distinct from 'unauthorized' then raise exception 'Revoked session allowed';end if;
end $$;
rollback;
