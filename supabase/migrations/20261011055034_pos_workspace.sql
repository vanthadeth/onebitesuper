-- Read-only POS bootstrap. Drafts remain local until the shift/payment stage.
create function public.onebite_pos_api(p_action text,p_payload jsonb,p_session_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare g jsonb; actor jsonb; role_id text;
begin
 g=public.onebite_session_guard(p_session_hash,true);
 if g ? 'error' then return g;end if;
 actor=g->'actor';role_id=actor->>'role';
 if not public.onebite_has_permission(role_id,'pos.access') then return jsonb_build_object('error','forbidden');end if;
 if p_action='photo.read' then
  if not exists(select 1 from public.onebite_item_versions v where v.item->>'photoPath'=p_payload->>'photoPath' and v.item->'definition'->'canSell'='true'::jsonb and v.effective_at<=now() and v.published_at<=now()) then return jsonb_build_object('error','forbidden');end if;
  return jsonb_build_object('photoPath',p_payload->>'photoPath');
 end if;
 if p_action<>'bootstrap' then return jsonb_build_object('error','invalid_action');end if;
 return jsonb_build_object('actor',actor,
  'permissions',coalesce((select jsonb_agg(permission order by permission) from public.onebite_role_permissions where role=role_id),'[]'::jsonb),
  'roleName',(select name from public.onebite_roles where id=role_id),
  'sites',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'location',s.location,'active',s.active) order by s.name) from public.onebite_sites s where s.active and (role_id='Owner' or exists(select 1 from public.onebite_user_sites us where us.site_id=s.id and us.user_id=(actor->>'id')::uuid))),'[]'::jsonb),
  'appSettings',(select app_settings from public.onebite_access_settings where id=true),
  'versions',coalesce((select jsonb_agg(jsonb_build_object('item',item,'effectiveAt',effective_at,'publishedAt',published_at) order by item_id,revision) from public.onebite_item_versions where published_at<=now()),'[]'::jsonb),
  'serverTime',now());
end;$$;
revoke all on function public.onebite_pos_api(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.onebite_pos_api(text,jsonb,text) to service_role;
