-- Prevent anonymous invocation of newly-created SECURITY DEFINER functions in OpsFinance.
-- Keep authenticated CREATE financial account RPC permission intact.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature, p.proname
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef and p.proname in (
      'create_financial_account_with_ledger',
      'ensure_default_coa',
      'enforce_bank_ledger_mapping',
      'prevent_opening_balance_edits',
      'prevent_posted_account_remapping',
      'prevent_posted_account_structure_changes',
      'require_balanced_opening_balance_journal',
      'seed_business_default_coa'
    )
  loop
    execute format('revoke execute on function %s from public, anon', f.signature);
  end loop;
end $$;
