-- Verify photo permissions and site linkage with transaction-only metadata fixtures.
begin;
set local role service_role;
do $$
declare owner_id uuid; staff_id uuid; fixture text:=substr(encode(extensions.gen_random_bytes(16),'hex'),1,20); token text:=encode(extensions.gen_random_bytes(32),'hex'); staff_token text:=encode(extensions.gen_random_bytes(32),'hex'); path text; foreign_path text; r jsonb; p jsonb; v_site integer;
begin
 perform 1 from public.onebite_access_settings where id=true for update;
 insert into public.onebite_users(name,username,role) values('Photo verification Owner','photo_o_'||fixture,'Owner') returning id into owner_id;
 insert into public.onebite_users(name,username,role) values('Photo verification Staff','photo_s_'||fixture,'Cashier') returning id into staff_id;
 insert into public.onebite_credentials(user_id,pin_hash,must_change) values(owner_id,'transaction-only',false),(staff_id,'transaction-only',false);
 insert into public.onebite_sessions(token_hash,user_id) values(token,owner_id),(staff_token,staff_id);
 insert into public.onebite_role_permissions(role,permission) values('Owner','sites.manage') on conflict do nothing;
 r=public.onebite_access_api('site.photo.authorize','{}',token);
 if r->'actor'->>'id' is distinct from owner_id::text then raise exception 'Owner photo authorization failed';end if;
 delete from public.onebite_role_permissions where role='Cashier' and permission in ('sites.manage','admin.access');
 r=public.onebite_access_api('site.photo.authorize','{}',staff_token);
 if r->>'error' is distinct from 'forbidden' then raise exception 'Unauthorized photo upload allowed';end if;
 insert into public.onebite_role_permissions(role,permission) values('Cashier','sites.manage'),('Cashier','admin.access');
 r=public.onebite_access_api('site.photo.authorize','{}',staff_token);
 if r->'actor'->>'id' is distinct from staff_id::text then raise exception 'Delegated photo upload denied';end if;
 delete from public.onebite_role_permissions where role='Cashier' and permission='admin.access';
 r=public.onebite_access_api('site.photo.authorize','{}',staff_token);
 if r->>'error' is distinct from 'forbidden' then raise exception 'Denied module allowed photo upload';end if;
 path=owner_id::text||'/'||gen_random_uuid()::text||'.jpg';foreign_path=staff_id::text||'/'||gen_random_uuid()::text||'.jpg';
 insert into storage.objects(bucket_id,name) values('site-photos',path),('site-photos',foreign_path);
 p=jsonb_build_object('name','Photo verification '||fixture,'location','Phnom Penh','runningFrom','2026-10-09','photoPath',path);
 r=public.onebite_access_api('site.create',p||jsonb_build_object('revision',(select revision from public.onebite_access_settings where id=true)),token);
 if r ? 'error' then raise exception 'Photo create failed: %',r->>'error';end if;
 select id into v_site from public.onebite_sites where photo_path=path;
 if v_site is null or not exists(select 1 from jsonb_array_elements(r->'state'->'sites') s where s->>'photoPath'=path) then raise exception 'Photo missing from snapshot';end if;
 r=public.onebite_access_api('site.update',(p-'photoPath')||jsonb_build_object('id',v_site,'active',true,'revision',(select revision from public.onebite_access_settings where id=true)),token);
 if r ? 'error' or not exists(select 1 from public.onebite_sites where id=v_site and photo_path=path) then raise exception 'Older client cleared photo';end if;
 for p in select jsonb_build_object('photoPath',v) from unnest(array['https://example.com/photo.jpg',foreign_path,owner_id::text||'/'||gen_random_uuid()::text||'.jpg']) v loop
  r=public.onebite_access_api('site.update',p||jsonb_build_object('id',v_site,'name','Photo verification '||fixture,'location','Phnom Penh','runningFrom','2026-10-09','active',true,'revision',(select revision from public.onebite_access_settings where id=true)),token);
  if r->>'error' is distinct from 'invalid_photo' then raise exception 'Invalid photo path allowed';end if;
 end loop;
 r=public.onebite_access_api('site.update',jsonb_build_object('id',v_site,'name','Photo verification '||fixture,'location','Phnom Penh','runningFrom','2026-10-09','photoPath',null,'active',true,'revision',(select revision from public.onebite_access_settings where id=true)),token);
 if r ? 'error' or exists(select 1 from public.onebite_sites where id=v_site and photo_path is not null) then raise exception 'Photo removal failed';end if;
end $$;
rollback;
select 'site photo verification passed' as result;
