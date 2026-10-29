-- Target: MYOPS isolated staging database wengxxiqwtosirealghx only. NOT Finance database or production.
CREATE OR REPLACE FUNCTION public.myops_validate_app_session(p_session_id uuid, p_app_id text, p_product_slug text, p_touch boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_session public.myops_app_sessions; v_reason text;
begin
  -- Match central logout's lock order: login first, app second.
  perform 1 from public.myops_login_sessions l
    where l.id = (select s.login_session_id from public.myops_app_sessions s
      where s.id=p_session_id and s.app_id=p_app_id and s.product_slug=p_product_slug)
    for update;
  select * into v_session from public.myops_app_sessions
    where id = p_session_id and app_id = p_app_id and product_slug = p_product_slug for update;
  if not found or v_session.revoked_at is not null then
    return jsonb_build_object('active', false);
  end if;
  if v_session.login_session_id is null
     or not public.myops_login_live(v_session.login_session_id, v_session.user_id) then
    v_reason := 'myops_logout';
  elsif v_session.created_at <= now() - interval '12 hours' then v_reason := 'absolute_expired';
  elsif v_session.last_activity_at <= now() - interval '15 minutes' then v_reason := 'idle_expired';
  end if;
  if v_reason is not null then
    update public.myops_app_sessions set revoked_at = now(), ended_reason = v_reason where id = p_session_id;
    insert into public.myops_app_audit (app_id, event, reason_code)
      values (p_app_id, 'session_revoked',
        case v_reason when 'myops_logout' then 'logout' else v_reason end);
    return jsonb_build_object('active', false);
  end if;
  if coalesce(p_touch, false) then
    -- Only an already-live app/login may extend inactivity. Absolute expiry remains.
    if not public.myops_login_touch(v_session.login_session_id, v_session.user_id) then
      return jsonb_build_object('active', false);
    end if;
    update public.myops_app_sessions set last_activity_at = now() where id = p_session_id;
  end if;
  return jsonb_build_object('active', true, 'user_id', v_session.user_id);
end $function$
