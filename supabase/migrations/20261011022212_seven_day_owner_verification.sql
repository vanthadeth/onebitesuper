-- Owner verification lasts seven days within the existing fixed-lifetime session.
-- Session expiry, revocation, active-user checks and PIN-change requirements remain enforced.
create or replace function public.onebite_session_guard(p_hash text,p_sensitive boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.onebite_users%rowtype;s public.onebite_sessions%rowtype;c public.onebite_credentials%rowtype;
begin
 select * into s from public.onebite_sessions where token_hash=p_hash for update;
 if not found or s.expires_at<=now() then
  delete from public.onebite_sessions where token_hash=p_hash;return jsonb_build_object('error','unauthorized');end if;
 select * into a from public.onebite_users where id=s.user_id and active;
 if not found then return jsonb_build_object('error','unauthorized');end if;
 select * into c from public.onebite_credentials where user_id=a.id;
 if c.must_change then return jsonb_build_object('error','pin_change_required');end if;
 if a.role='Owner' and s.mfa_at is null then return jsonb_build_object('error','mfa_required');end if;
 if a.role='Owner' and s.mfa_at<=now()-interval '7 days' then return jsonb_build_object('error','reauth_required');end if;
 update public.onebite_sessions set last_seen=now() where token_hash=p_hash;
 return jsonb_build_object('actor',public.onebite_account_json(a.id));
end $$;

