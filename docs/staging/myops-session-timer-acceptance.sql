-- Target: MYOPS isolated staging database wengxxiqwtosirealghx only. NOT Finance database or production.
begin;
do $uat$
declare u uuid; l uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); r jsonb;
begin
 select user_id into strict u from public.myops_app_sessions where app_id='opsfinance' limit 1;
 insert into public.myops_login_sessions(id,user_id,last_activity_at) values(l,u,now()-interval '14 minutes');
 insert into public.myops_app_sessions(id,user_id,app_id,product_slug,login_session_id,last_activity_at) values(s,u,'opsfinance','opsfinance',l,now()-interval '14 minutes');
 r:=public.myops_validate_app_session(s,'opsfinance','opsfinance',false);
 if r->>'active'<>'true' or exists(select 1 from public.myops_login_sessions where id=l and last_activity_at<>now()-interval '14 minutes') then raise exception 'Passive validation changed login activity'; end if;
 r:=public.myops_validate_app_session(s,'opsfinance','opsfinance',true);
 if r->>'active'<>'true' or not exists(select 1 from public.myops_login_sessions where id=l and last_activity_at=now()) or not exists(select 1 from public.myops_app_sessions where id=s and last_activity_at=now()) then raise exception 'Activity did not synchronize both timers'; end if;
 update public.myops_app_sessions set last_activity_at=now()-interval '15 minutes' where id=s;
 r:=public.myops_validate_app_session(s,'opsfinance','opsfinance',true);
 if r->>'active'<>'false' then raise exception 'Activity revived expired app'; end if;
 update public.myops_app_sessions set revoked_at=null,ended_reason=null,last_activity_at=now() where id=s;
 update public.myops_login_sessions set last_activity_at=now()-interval '15 minutes' where id=l;
 r:=public.myops_validate_app_session(s,'opsfinance','opsfinance',true);
 if r->>'active'<>'false' then raise exception 'Activity revived expired login'; end if;
 update public.myops_login_sessions set last_activity_at=now(),revoked_at=now(),ended_reason='logout' where id=l;
 update public.myops_app_sessions set revoked_at=null,ended_reason=null,last_activity_at=now() where id=s;
 r:=public.myops_validate_app_session(s,'opsfinance','opsfinance',true);
 if r->>'active'<>'false' then raise exception 'Activity revived logged-out session'; end if;
end $uat$;
rollback;
select 'PASS: passive check preserves both timers; activity synchronizes live timers; expired app/login and central logout remain denied; fixtures rolled back' as result;