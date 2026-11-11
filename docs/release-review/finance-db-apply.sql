-- REVIEW ONLY: target OpsFinance Production ozkjsihuovzpujuabupa. NOT EXECUTED.
-- Existing DML grants remain; no entitlement, membership, credential or business data changes.
begin;
do $$ begin
 if not exists(select 1 from private.myops_broker_config where id=true and enabled and length(key_hash)=64) then raise exception 'Broker prerequisite failed'; end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='financial_accounts' and column_name='account_number') then raise exception 'Schema changed: re-run read-only preflight'; end if;
end $$;
alter table public.financial_accounts add column bank_name text, add column company_name text, add column account_number text;
alter table public.financial_accounts add constraint financial_account_number_format check (account_number is null or account_number ~ '^[0-9]{4,34}$');
alter table public.bank_statements add column verified_account_number text;
create policy import_statement_owner_required on public.bank_statements as restrictive for insert to authenticated
 with check (uploaded_by=(select auth.uid()) and exists(select 1 from public.financial_accounts f where f.id=financial_account_id and f.business_id=bank_statements.business_id));
create policy reconciliation_reference_scope_required on public.reconciliation_matches as restrictive for insert to authenticated
 with check (matched_by=(select auth.uid())
 and exists(select 1 from public.bank_transactions bt join public.bank_statements bs on bs.id=bt.bank_statement_id where bt.id=bank_transaction_id and bs.business_id=reconciliation_matches.business_id)
 and exists(select 1 from public.transactions t where t.id=transaction_id and t.business_id=reconciliation_matches.business_id));
create policy import_audit_actor_required on public.audit_logs as restrictive for insert to authenticated
 with check (user_id=(select auth.uid()));
-- TRUNCATE is not row-filtered by RLS. No TRUNCATE command is executed.
revoke truncate on all tables in schema public from anon, authenticated;
commit;
