-- The API authenticator preloads safeupdate, which rejects UPDATE without WHERE.
-- Preserve the deployed function body and its service-only privileges.
do $migration$
declare definition text;
begin
 definition=pg_get_functiondef('public.onebite_access_api(text,jsonb,text)'::regprocedure);
 definition=replace(definition,
  'update public.onebite_access_settings set bootstrap_hash=null,bootstrap_used=true,revision=revision+1;',
  'update public.onebite_access_settings set bootstrap_hash=null,bootstrap_used=true,revision=revision+1 where id=true;');
 definition=replace(definition,
  'update public.onebite_access_settings set revision=revision+1;',
  'update public.onebite_access_settings set revision=revision+1 where id=true;');
 execute definition;
end;
$migration$;
