alter table public.financial_accounts
  add column if not exists account_id uuid references public.accounts(id) on delete restrict;

create index if not exists idx_financial_accounts_account_id
  on public.financial_accounts (account_id);

create or replace function public.ensure_financial_account_business_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.account_id is not null and not exists (
    select 1
    from public.accounts a
    where a.id = new.account_id
      and a.business_id = new.business_id
  ) then
    raise exception 'COA mapping does not belong to this business.';
  end if;

  return new;
end;
$$;

drop trigger if exists financial_accounts_business_scope on public.financial_accounts;
create trigger financial_accounts_business_scope
before insert or update on public.financial_accounts
for each row
execute function public.ensure_financial_account_business_scope();
