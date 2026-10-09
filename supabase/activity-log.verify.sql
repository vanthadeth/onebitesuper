begin;
set local role service_role;
do $$
declare owner_id uuid;staff_id uuid;token text:=encode(extensions.gen_random_bytes(32),'hex');staff_token text:=encode(extensions.gen_random_bytes(32),'hex');fixture text:=substr(token,1,20);r jsonb;page jsonb;seen jsonb:='[]';c jsonb;bad jsonb;n integer;
begin
 insert into public.onebite_users(name,username,role) values('Activity verification','activity_o_'||fixture,'Owner') returning id into owner_id;
 insert into public.onebite_users(name,username,role) values('Activity staff','activity_s_'||fixture,'Cashier') returning id into staff_id;
 insert into public.onebite_credentials(user_id,pin_hash,must_change) values(owner_id,'transaction-only',false),(staff_id,'transaction-only',false);
 insert into public.onebite_sessions(token_hash,user_id) values(token,owner_id),(staff_token,staff_id);
 insert into public.onebite_access_audit(time,actor_id,actor_name,action,target_name,detail)
 select '2098-01-01T17:00:00Z'::timestamptz,owner_id,'Verify','verify',fixture,i::text from generate_series(1,65)i;
 insert into public.onebite_access_audit(time,actor_id,actor_name,action,target_name,detail) values
 ('2098-01-01T16:59:59Z',owner_id,'Verify','verify',fixture,'before'),('2098-01-02T17:00:00Z',owner_id,'Verify','verify',fixture,'after');
 if public.onebite_activity_page('{}',null)->>'error' is distinct from 'unauthorized' then raise exception 'Unauthenticated logs allowed';end if;
 if public.onebite_activity_page('{}',staff_token)->>'error' is distinct from 'forbidden' then raise exception 'Staff logs allowed';end if;
 for n in 1..3 loop
  r=public.onebite_activity_page(jsonb_build_object('start','2098-01-02','end','2098-01-02','cursor',c),token);
  if r ? 'error' then raise exception 'Page % failed: % cursor %',n,r,c;end if;
  page=r->'events';
  if jsonb_array_length(page)<>(case when n<3 then 30 else 5 end) then raise exception 'Wrong page length: %',jsonb_array_length(page);end if;
  if exists(select 1 from jsonb_array_elements(page)p,jsonb_array_elements(seen)s where p->>'id'=s->>'id') then raise exception 'Duplicate cursor boundary';end if;
  if exists(select 1 from jsonb_array_elements(page)p where p->>'detail' in ('before','after')) then raise exception 'Cambodia date boundary failed';end if;
  seen=seen||page;c=r->'nextCursor';
 end loop;
 if c<>'null'::jsonb or jsonb_array_length(seen)<>65 then raise exception 'Paging did not finish';end if;
 for bad in select value from jsonb_array_elements('[{"start":"2098-02-30"},{"start":"2098-01-03","end":"2098-01-02"},{"cursor":{}},{"cursor":{"time":"invalid","id":"invalid"}},{"extra":true},{"start":false}]'::jsonb) loop
  if public.onebite_activity_page(bad,token)->>'error' is distinct from 'invalid_range' then raise exception 'Invalid range accepted: %',bad;end if;
 end loop;
 update public.onebite_credentials set must_change=true where user_id=owner_id;
 if public.onebite_activity_page('{}',token)->>'error' is distinct from 'pin_change_required' then raise exception 'PIN reset bypass';end if;
 update public.onebite_credentials set must_change=false where user_id=owner_id;
 delete from public.onebite_role_permissions where role='Owner' and permission='admin.access';
 if public.onebite_activity_page('{}',token)->>'error' is distinct from 'forbidden' then raise exception 'Module denied bypass';end if;
 if has_function_privilege('anon','public.onebite_activity_page(jsonb,text)','execute') or has_function_privilege('authenticated','public.onebite_activity_page(jsonb,text)','execute') then raise exception 'Public RPC access';end if;
end;
$$;
rollback;
