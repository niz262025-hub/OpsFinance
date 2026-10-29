-- Finance staging only. Baseline: no authenticated privileges on these four tables.
-- Rollback: revoke select,insert on public.bank_statements,public.bank_transactions,public.reconciliation_matches from authenticated;
-- revoke update(status) on public.bank_statements,public.bank_transactions from authenticated;
-- revoke insert on public.audit_logs from authenticated; drop the three policies added below.
do $$ begin
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('bank_statements','bank_transactions','reconciliation_matches','audit_logs') and c.relrowsecurity)<>4
 or (select count(*) from pg_policies where schemaname='public' and tablename in ('bank_statements','bank_transactions','reconciliation_matches','audit_logs') and policyname='myops_broker_required' and permissive='RESTRICTIVE')<>4
 then raise exception 'Import grants require existing RLS and broker policies'; end if;
end $$;
create policy import_statement_owner_required on public.bank_statements as restrictive for insert to authenticated
 with check (uploaded_by=(select auth.uid()) and exists(select 1 from public.financial_accounts f where f.id=financial_account_id and f.business_id=bank_statements.business_id));
create policy reconciliation_reference_scope_required on public.reconciliation_matches as restrictive for insert to authenticated
 with check (matched_by=(select auth.uid())
 and exists(select 1 from public.bank_transactions bt join public.bank_statements bs on bs.id=bt.bank_statement_id where bt.id=bank_transaction_id and bs.business_id=reconciliation_matches.business_id)
 and exists(select 1 from public.transactions t where t.id=transaction_id and t.business_id=reconciliation_matches.business_id));
create policy import_audit_actor_required on public.audit_logs as restrictive for insert to authenticated
 with check (user_id=(select auth.uid()));
grant select,insert on public.bank_statements,public.bank_transactions,public.reconciliation_matches to authenticated;
grant update(status) on public.bank_statements,public.bank_transactions to authenticated;
grant insert on public.audit_logs to authenticated;
