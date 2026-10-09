-- Parenthesize the cursor object before subtracting its permitted keys.
create or replace function public.onebite_activity_page(p_payload jsonb,p_session_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 a public.onebite_users%rowtype;
 from_day date;to_day date;before_time timestamptz;before_id uuid;
 rows jsonb;page jsonb;last_row jsonb;
begin
 select u.* into a from public.onebite_users u join public.onebite_sessions s on s.user_id=u.id
 where s.token_hash=p_session_hash and s.expires_at>now() and u.active;
 if not found then return jsonb_build_object('error','unauthorized');end if;
 if exists(select 1 from public.onebite_credentials c where c.user_id=a.id and c.must_change) then return jsonb_build_object('error','pin_change_required');end if;
 if not public.onebite_has_permission(a.role,'admin.access') or not public.onebite_has_permission(a.role,'users.manage') then return jsonb_build_object('error','forbidden');end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or p_payload-array['start','end','cursor']<>'{}'::jsonb then return jsonb_build_object('error','invalid_range');end if;
 begin
  if coalesce(p_payload->>'start','')<>'' then
   if jsonb_typeof(p_payload->'start')<>'string' or p_payload->>'start' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return jsonb_build_object('error','invalid_range');end if;
   from_day=(p_payload->>'start')::date;
  end if;
  if coalesce(p_payload->>'end','')<>'' then
   if jsonb_typeof(p_payload->'end')<>'string' or p_payload->>'end' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return jsonb_build_object('error','invalid_range');end if;
   to_day=(p_payload->>'end')::date;
  end if;
  if from_day>to_day then return jsonb_build_object('error','invalid_range');end if;
  if p_payload ? 'cursor' and p_payload->'cursor'<>'null'::jsonb then
   if jsonb_typeof(p_payload->'cursor')<>'object' or (p_payload->'cursor')-array['time','id']<>'{}'::jsonb
    or jsonb_typeof(p_payload->'cursor'->'time') is distinct from 'string' or jsonb_typeof(p_payload->'cursor'->'id') is distinct from 'string'
    or p_payload->'cursor'->>'time' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' then return jsonb_build_object('error','invalid_range');end if;
   before_time=(p_payload->'cursor'->>'time')::timestamptz;before_id=(p_payload->'cursor'->>'id')::uuid;
  end if;
 exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then return jsonb_build_object('error','invalid_range');end;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'time',e.time,'actorId',e.actor_id,'actorName',e.actor_name,'action',e.action,'targetName',e.target_name,'detail',e.detail) order by e.time desc,e.id desc),'[]'::jsonb) into rows
 from (select * from public.onebite_access_audit e
  where (from_day is null or e.time>=from_day::timestamp at time zone 'Asia/Phnom_Penh')
   and (to_day is null or e.time<(to_day+1)::timestamp at time zone 'Asia/Phnom_Penh')
   and (before_time is null or (e.time,e.id)<(before_time,before_id))
  order by e.time desc,e.id desc limit 31) e;
 select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into page from jsonb_array_elements(rows) with ordinality where ordinality<=30;
 last_row=page->(jsonb_array_length(page)-1);
 return jsonb_build_object('events',page,'nextCursor',case when jsonb_array_length(rows)>30 then jsonb_build_object('time',last_row->'time','id',last_row->'id') else null end);
end;
$$;
revoke all on function public.onebite_activity_page(jsonb,text) from public,anon,authenticated;
grant execute on function public.onebite_activity_page(jsonb,text) to service_role;
