-- Data API table privileges and row policies are separate. The SSO identity
-- bridge needs these read privileges before its existing tenant policies can run.
-- Snapshot existing grants before any production rollout: where these grants
-- did not previously exist, rollback is REVOKE SELECT on these tables from
-- authenticated. Do not revoke privileges that predated this migration.
do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('business_members','businesses')
      and not c.relrowsecurity
  ) then raise exception 'Identity read grants require RLS on both tables'; end if;
end $$;
grant select on public.business_members,public.businesses to authenticated;
