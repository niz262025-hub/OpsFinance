-- Existing Supabase databases may grant EXECUTE to anon directly.
-- REVOKE FROM PUBLIC alone does not remove that independent grant.
-- Keep authenticated business-member access and the migration 013 membership predicate.
revoke execute on function public.get_accounting_idempotency(uuid, text, text) from anon;
revoke execute on function public.get_accounting_idempotency(uuid, text, text) from public;
grant execute on function public.get_accounting_idempotency(uuid, text, text) to authenticated;
