# OpsFinance staging migration ledger — 2026-11-25

Source: Supabase staging tfwizcztyktdurmiynzs, schema_migrations. Production baseline ef9273fae98582903e64256796d82dce8a1eaf7c.

This is an archival record of five applied migrations, not an executable migration chain. Do not replay on production or an existing database: earlier repository migrations may already define these objects. Reconcile historical versions and dependencies before creating a fresh executable chain.

## 20261125121114 — production_parity_accounting_rule_columns

Applied SQL from database ledger:

```sql
alter table public.accounting_rules add column if not exists priority integer not null default 0, add column if not exists match_type text not null default 'CONTAINS', add column if not exists match_value text not null default '', add column if not exists suggested_account_id uuid, add column if not exists suggested_financial_account_id uuid, add column if not exists suggested_transaction_type text, add column if not exists event_type text, add column if not exists conditions jsonb;
```

## 20261125121721 — production_parity_accounting_rules_guards

Applied SQL from database ledger:

```sql
create or replace function public.enforce_accounting_rule_business_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.auto_post is distinct from false then
    raise exception 'Accounting rules cannot enable automatic posting.';
  end if;

  if new.suggested_account_id is not null and not exists (
    select 1
    from public.accounts a
    where a.id = new.suggested_account_id
      and a.business_id = new.business_id
  ) then
    raise exception 'Suggested account does not belong to the current business.';
  end if;

  if new.suggested_financial_account_id is not null and not exists (
    select 1
    from public.financial_accounts fa
    where fa.id = new.suggested_financial_account_id
      and fa.business_id = new.business_id
  ) then
    raise exception 'Suggested financial account does not belong to the current business.';
  end if;

  if new.suggested_account_id is not null and new.suggested_financial_account_id is not null then
    if not exists (
      select 1
      from public.financial_accounts fa
      where fa.id = new.suggested_financial_account_id
        and fa.business_id = new.business_id
    ) then
      raise exception 'Suggested financial account does not belong to the current business.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_accounting_rule_business_scope() from public;

drop trigger if exists accounting_rules_business_scope_guard on public.accounting_rules;
create trigger accounting_rules_business_scope_guard
before insert or update on public.accounting_rules
for each row
execute function public.enforce_accounting_rule_business_scope();


alter table public.accounting_rules add constraint accounting_rules_match_type_guard check (match_type in ('CONTAINS','EXACT','STARTS_WITH','ENDS_WITH')), add constraint accounting_rules_priority_guard check (priority >= 0), add constraint accounting_rules_auto_post_guard check (auto_post = false), add constraint accounting_rules_suggested_tx_type_guard check (suggested_transaction_type is null or suggested_transaction_type in ('INCOME','EXPENSE','TRANSFER'));
create index idx_accounting_rules_priority on public.accounting_rules (business_id, priority desc, created_at asc);
create index idx_accounting_rules_match_config on public.accounting_rules (business_id, match_type, match_value);

revoke execute on function public.enforce_accounting_rule_business_scope() from anon, authenticated;

```

## 20261125130901 — production_parity_auth_profile_sync

Applied SQL from database ledger:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_auth_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$ declare v_name text; begin if new.id is null then return new; end if; v_name := coalesce(new.raw_user_meta_data ->> 'full_name',new.raw_user_meta_data ->> 'name',split_part(new.email,'@',1)); insert into public.users(id,email,name) values(new.id,new.email,v_name) on conflict(id) do update set email=excluded.email,name=excluded.name,updated_at=now(); return new; end; $function$; REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated; CREATE TRIGGER sync_public_user_profile AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
```

## 20261125131811 — production_parity_accounting_minimum_grants

Applied SQL from database ledger:

```sql
GRANT SELECT, INSERT, UPDATE ON public.accounting_rules, public.accounting_periods TO authenticated;
```

## 20261125132220 — production_parity_reconciliation_status_grants

Applied SQL from database ledger:

```sql
GRANT UPDATE (status) ON public.bank_statements, public.bank_transactions TO authenticated;
```

## Rollback procedure (not executed)

Use staging only. Confirm backup and dependency inventory, obtain approval for destructive operations, and rehearse on isolated recovery infrastructure. Prefer restoring the verified prior state. Reverse in descending version order. Revoke UPDATE(status) on the two bank tables and SELECT/INSERT/UPDATE on the two accounting tables only if reverting the newly introduced privileges. For auth sync, remove only the newly installed trigger and restore the prior function definition/ACL or remove the function if absent before. For accounting guards, restore prior function/trigger/ACL and remove only the four added constraints and two added indexes after dependency review. Dropping the eight added columns can destroy data; do not execute without backup and explicit approval. Do not use CASCADE. Verify application and security regression after rollback.

## Evidence and open gates

Five migration ledger entries verified. Prior staging SQL checks: auth sync, atomic posting, rule guards, permission rejection and reconciliation rejection passed; synthetic broker SELECT/UPDATE isolation passed in both directions. Cross-tenant INSERT and valid broker reconciliation remain pending hosted UAT. No production changes authorized. CI and fresh-database replay are not established by this record.
