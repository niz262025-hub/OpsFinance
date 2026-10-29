-- Additive staging change. Existing account numbers remain NULL until the owner supplies them.
alter table public.financial_accounts add column bank_name text, add column company_name text, add column account_number text;
alter table public.financial_accounts add constraint financial_account_number_format check (account_number is null or account_number ~ '^[0-9]{4,34}$');
alter table public.bank_statements add column verified_account_number text;
comment on column public.bank_statements.verified_account_number is 'Full account number matched server-side against explicit statement metadata before import; required again before posting.';
