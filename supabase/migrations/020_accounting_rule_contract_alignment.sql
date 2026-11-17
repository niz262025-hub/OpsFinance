alter table public.accounting_rules
  add column if not exists description text,
  add column if not exists priority integer,
  add column if not exists match_type text,
  add column if not exists match_value text,
  add column if not exists suggested_account_id uuid,
  add column if not exists suggested_financial_account_id uuid,
  add column if not exists suggested_transaction_type text,
  add column if not exists event_type text,
  add column if not exists conditions jsonb;

update public.accounting_rules
set
  priority = coalesce(priority, 0),
  match_type = coalesce(match_type, 'CONTAINS'),
  match_value = coalesce(match_value, coalesce(match_pattern, '')),
  suggested_account_id = coalesce(suggested_account_id, debit_account_id),
  suggested_financial_account_id = coalesce(suggested_financial_account_id, credit_account_id),
  suggested_transaction_type = coalesce(suggested_transaction_type, 'EXPENSE'),
  auto_suggest = coalesce(auto_suggest, true),
  auto_post = coalesce(auto_post, false),
  is_active = coalesce(is_active, true)
where true;

alter table public.accounting_rules
  alter column priority set default 0,
  alter column priority set not null,
  alter column match_type set default 'CONTAINS',
  alter column match_type set not null,
  alter column match_value set default '',
  alter column match_value set not null,
  alter column auto_suggest set default true,
  alter column auto_suggest set not null,
  alter column auto_post set default false,
  alter column auto_post set not null,
  alter column is_active set default true,
  alter column is_active set not null;

alter table public.accounting_rules
  drop constraint if exists accounting_rules_match_type_guard,
  add constraint accounting_rules_match_type_guard check (match_type in ('CONTAINS', 'EXACT', 'STARTS_WITH', 'ENDS_WITH')),
  drop constraint if exists accounting_rules_priority_guard,
  add constraint accounting_rules_priority_guard check (priority >= 0),
  drop constraint if exists accounting_rules_auto_post_guard,
  add constraint accounting_rules_auto_post_guard check (auto_post = false),
  drop constraint if exists accounting_rules_suggested_tx_type_guard,
  add constraint accounting_rules_suggested_tx_type_guard check (suggested_transaction_type is null or suggested_transaction_type in ('INCOME', 'EXPENSE', 'TRANSFER'));

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

alter table public.accounting_rules enable row level security;
drop policy if exists "Business members can read accounting rules" on public.accounting_rules;
create policy "Business members can read accounting rules"
on public.accounting_rules
for select
using (public.is_authorized_for_business(business_id));

drop policy if exists "Business owners/admins can manage rules" on public.accounting_rules;
create policy "Business owners/admins can manage rules"
on public.accounting_rules
for insert
with check (public.is_business_owner_or_admin(business_id));

drop policy if exists "Business owners/admins can update rules" on public.accounting_rules;
create policy "Business owners/admins can update rules"
on public.accounting_rules
for update
using (public.is_business_owner_or_admin(business_id))
with check (public.is_business_owner_or_admin(business_id));

drop policy if exists "Accounting rules are not deleted" on public.accounting_rules;
create policy "Accounting rules are not deleted"
on public.accounting_rules
for delete
using (false);

create index if not exists idx_accounting_rules_priority on public.accounting_rules (business_id, priority desc, created_at asc);
create index if not exists idx_accounting_rules_match_config on public.accounting_rules (business_id, match_type, match_value);
