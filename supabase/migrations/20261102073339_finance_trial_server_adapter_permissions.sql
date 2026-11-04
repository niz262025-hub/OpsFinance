-- Minimum invoker permissions required by the server-only atomic trial adapters.
-- Browser roles and all RLS policies remain unchanged.
grant select on public.financial_accounts,public.bank_statements,public.bank_transactions to service_role;
grant insert on public.bank_statements,public.bank_transactions,public.audit_logs to service_role;
-- SELECT FOR UPDATE serializes quota checks without permitting company edits.
grant update (id) on public.businesses to service_role;
