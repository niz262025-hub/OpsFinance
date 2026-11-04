-- Restrict privileged accounting functions from the anonymous Data API role.
-- Preserve authenticated and service-role access; trigger invocation continues under DB trigger privileges.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature, p.proname
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
      and p.proname in (
        'create_business_with_owner','ensure_financial_account_business_scope',
        'handle_new_auth_user','is_authorized_for_business',
        'is_business_owner_or_admin','is_posted_journal_entry',
        'is_posted_journal_line','manage_business_membership',
        'post_accounting_transaction_atomic','prevent_posted_journal_line_mutation',
        'prevent_posted_journal_mutation'
      )
  loop
    execute format('revoke execute on function %s from public, anon', f.signature);
    execute format('grant execute on function %s to authenticated, service_role', f.signature);
  end loop;
end $$;
