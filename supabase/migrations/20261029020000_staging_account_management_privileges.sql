-- Staging-only repair: table privileges are required in addition to RLS.
-- Snapshot verified INSERT/UPDATE absent on both tables before applying.
-- Rollback: revoke insert, update on public.accounts, public.financial_accounts from authenticated;
do $$
begin
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('accounts','financial_accounts') and not c.relrowsecurity)
 or (select count(*) from pg_policies where schemaname='public' and tablename in ('accounts','financial_accounts') and policyname='myops_broker_required' and permissive='RESTRICTIVE')<>2
 then raise exception 'Account write grants require existing tenant RLS and broker policies'; end if;
end $$;
grant insert, update on public.accounts, public.financial_accounts to authenticated;