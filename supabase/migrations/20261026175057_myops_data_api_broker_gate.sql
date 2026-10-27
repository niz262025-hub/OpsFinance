-- Installed disabled. Activation requires an operator to provision a SHA-256
-- digest and enable this singleton AFTER the application sends the broker key.
-- Rollback: UPDATE private.myops_broker_config SET enabled=false WHERE id=true;
-- No existing tenant policy, grant or business membership is replaced.
create schema if not exists private;
create table private.myops_broker_config (
  id boolean primary key default true check(id),
  enabled boolean not null default false,
  key_hash text check(key_hash ~ '^[0-9a-f]{64}$'),
  check(not enabled or key_hash is not null)
);
alter table private.myops_broker_config enable row level security;
revoke all on private.myops_broker_config from public,anon,authenticated,service_role;
insert into private.myops_broker_config(id) values(true);

-- SECURITY DEFINER reads only private configuration; it never reads tenant data
-- or authenticates a user. Normal membership RLS still applies after this gate.
create function private.myops_broker_allowed() returns boolean
language plpgsql stable security definer set search_path='' as $$
declare cfg private.myops_broker_config; supplied text;
begin
  select * into cfg from private.myops_broker_config where id=true;
  if not found then return false; end if;
  if not cfg.enabled then return true; end if;
  supplied := nullif(current_setting('request.headers',true),'')::jsonb->>'x-myops-broker-key';
  if supplied is null or length(supplied)<32 or length(supplied)>256 then return false; end if;
  return encode(sha256(convert_to(supplied,'UTF8')),'hex')=cfg.key_hash;
exception when others then return false;
end $$;
revoke all on function private.myops_broker_allowed() from public;
grant usage on schema private to anon,authenticated,service_role;
grant execute on function private.myops_broker_allowed() to anon,authenticated,service_role;

create function private.myops_check_request() returns void
language plpgsql stable security invoker set search_path='' as $$
begin
  if not private.myops_broker_allowed() then
    raise insufficient_privilege using message='MYOPS application access required.';
  end if;
end $$;
revoke all on function private.myops_check_request() from public;
grant execute on function private.myops_check_request() to anon,authenticated,service_role;

-- Restrictive policies also close non-PostgREST paths (Realtime/Storage).
-- They AND with existing permissive tenant policies; they cannot grant access.
do $$ declare t record; begin
  for t in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind in ('r','p') and c.relrowsecurity
      and (n.nspname='public' or (n.nspname='storage' and c.relname='objects'))
  loop
    execute format('create policy myops_broker_required on %I.%I as restrictive for all to anon,authenticated using ((select private.myops_broker_allowed())) with check ((select private.myops_broker_allowed()))',t.nspname,t.relname);
  end loop;
end $$;

-- Refuse to silently replace a pre-existing deployment-specific hook.
do $$ declare hook text; begin
  for hook in select split_part(setting,'=',2) from pg_db_role_setting s
    cross join lateral unnest(s.setconfig) setting
    where s.setrole in (0,coalesce((select oid from pg_roles where rolname='authenticator'),0))
      and s.setdatabase in (0,(select oid from pg_database where datname=current_database()))
      and setting like 'pgrst.db_pre_request=%'
  loop
    if coalesce(hook,'') not in ('','private.myops_check_request') then
      raise exception 'Existing Data API hook requires explicit composition';
    end if;
  end loop;
  if exists(select 1 from pg_roles where rolname='authenticator') then
    alter role authenticator set pgrst.db_pre_request='private.myops_check_request';
  end if;
end $$;
notify pgrst,'reload config';
