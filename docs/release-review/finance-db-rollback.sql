-- REVIEW ONLY: OpsFinance Production; restore runtime first. NOT EXECUTED.
-- Preserve additive columns and any entered bank data. Do not regrant TRUNCATE.
begin;
drop policy if exists import_statement_owner_required on public.bank_statements;
drop policy if exists reconciliation_reference_scope_required on public.reconciliation_matches;
drop policy if exists import_audit_actor_required on public.audit_logs;
commit;
