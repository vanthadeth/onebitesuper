-- Private, self-service profile photos. All access uses the existing opaque session.
alter table public.onebite_users add column photo_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-photos','profile-photos',false,750000,array['image/jpeg']);

create or replace function public.onebite_account_json(p_id uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',u.id,'name',u.name,'username',u.username,'role',u.role,'active',u.active,'photoPath',u.photo_path,'sites',coalesce((select jsonb_agg(s.site_id order by s.site_id) from public.onebite_user_sites s where s.user_id=u.id),'[]'::jsonb)) from public.onebite_users u where u.id=p_id;
$$;

create function public.onebite_profile_photo_api(p_action text,p_payload jsonb,p_session_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare g jsonb;uid uuid;photo_id uuid;photo text;old_photo text;v_revision bigint;actor_name text;
begin
 if p_action not in ('authorize','read','update') then return jsonb_build_object('error','invalid_action');end if;
 -- Use the same lock order as account writes; prevent lost updates and revoked sessions.
 if p_action='update' then select s.revision into v_revision from public.onebite_access_settings s where id=true for update;end if;
 g=public.onebite_session_guard(p_session_hash);
 if g ? 'error' then return g;end if;
 uid=(g->'actor'->>'id')::uuid;
 if p_action='read' then
  begin photo_id=coalesce((p_payload->>'id')::uuid,uid);exception when invalid_text_representation then return jsonb_build_object('error','forbidden');end;
  if photo_id<>uid and not exists(select 1 from jsonb_array_elements(public.onebite_access_snapshot(uid)->'users') u where u->>'id'=photo_id::text) then return jsonb_build_object('error','forbidden');end if;
  select photo_path into photo from public.onebite_users where id=photo_id;
  return jsonb_build_object('photoPath',photo);
 end if;
 if p_payload ? 'id' and p_payload->>'id' is distinct from uid::text then return jsonb_build_object('error','forbidden');end if;
 select photo_path,name into old_photo,actor_name from public.onebite_users where id=uid;
 if not public.onebite_rate_limit('profile-photo:'||uid::text,10,60) then return jsonb_build_object('error','login_throttled');end if;
 if p_action='authorize' then return g||jsonb_build_object('orphanPaths',coalesce((select jsonb_agg(o.name) from (select name from storage.objects where bucket_id='profile-photos' and split_part(name,'/',1)=uid::text and name is distinct from old_photo and created_at<now()-interval '24 hours' limit 50)o),'[]'::jsonb));end if;
 if jsonb_typeof(p_payload->'revision') is distinct from 'number' or p_payload->>'revision' is distinct from v_revision::text then return jsonb_build_object('error','stale_revision');end if;
 if not p_payload ? 'photoPath' or jsonb_typeof(p_payload->'photoPath') not in ('string','null') then return jsonb_build_object('error','invalid_photo');end if;
 photo=p_payload->>'photoPath';
 if photo is not null and (photo !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.jpg$' or split_part(photo,'/',1)<>uid::text or not exists(select 1 from storage.objects where bucket_id='profile-photos' and name=photo and (photo=old_photo or created_at>now()-interval '24 hours'))) then return jsonb_build_object('error','invalid_photo');end if;
 update public.onebite_users set photo_path=photo,updated_at=now() where id=uid;
 update public.onebite_access_settings set revision=revision+1 where id=true;
 insert into public.onebite_access_audit(actor_id,actor_name,action,target_name,detail) values(uid,actor_name,'profile.photo.updated',actor_name,case when photo is null then 'Profile photo removed' else 'Profile photo changed' end);
 return jsonb_build_object('ok',true,'actor',public.onebite_account_json(uid),'state',public.onebite_access_snapshot(uid));
end $$;

-- No anonymous/authenticated Storage policies: only server credentials can read/write.
revoke execute on function public.onebite_profile_photo_api(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.onebite_profile_photo_api(text,jsonb,text) to service_role;
