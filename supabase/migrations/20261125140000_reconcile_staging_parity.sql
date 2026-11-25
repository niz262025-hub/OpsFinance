-- Reconciled forward migration; do not replay the historical staging ledger.
-- Accounting rule columns, constraints, indexes and trigger are supplied by 020.
-- Preserve existing trigger if it matches the expected contract; fail closed otherwise.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$ declare v_name text; begin if new.id is null then return new; end if; v_name := coalesce(new.raw_user_meta_data ->> 'full_name',new.raw_user_meta_data ->> 'name',split_part(new.email,'@',1)); insert into public.users(id,email,name) values(new.id,new.email,v_name) on conflict(id) do update set email=excluded.email,name=excluded.name,updated_at=now(); return new; end; $function$; REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated; 
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='sync_public_user_profile' AND NOT tgisinternal) THEN
    CREATE TRIGGER sync_public_user_profile AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
  ELSIF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='sync_public_user_profile' AND tgfoid='public.handle_new_auth_user()'::regprocedure AND tgenabled='O' AND tgtype=21 AND tgattr::text = (SELECT string_agg(attnum::text,' ' ORDER BY attnum) FROM pg_attribute WHERE attrelid='auth.users'::regclass AND attname IN ('email','raw_user_meta_data'))) THEN
    RAISE EXCEPTION 'Existing profile sync trigger requires manual reconciliation';
  END IF;
END;
$migration$;
REVOKE EXECUTE ON FUNCTION public.enforce_accounting_rule_business_scope() FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.accounting_rules, public.accounting_periods TO authenticated;
GRANT UPDATE (status) ON public.bank_statements, public.bank_transactions TO authenticated;
