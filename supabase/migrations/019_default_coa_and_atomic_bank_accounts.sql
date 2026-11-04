create or replace function public.ensure_default_coa(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_root record;
  v_default record;
  v_root_id uuid;
  v_parent_id uuid;
  v_candidate integer;
  v_group_end integer;
begin
  if p_business_id is null or not exists (
    select 1 from public.businesses b where b.id = p_business_id
  ) then
    raise exception 'Business not found.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('default-coa:' || p_business_id::text, 0));

  for v_root in
    select * from (values
      ('1000', 'Assets', 'ASSET'),
      ('2000', 'Liabilities', 'LIABILITY'),
      ('3000', 'Equity', 'EQUITY'),
      ('4000', 'Revenue', 'REVENUE'),
      ('5000', 'Expenses', 'EXPENSE'),
      ('5500', 'Cost of Goods Sold', 'COGS')
    ) as roots(preferred_code, name, account_type)
  loop
    select a.id into v_root_id
    from public.accounts a
    where a.business_id = p_business_id
      and a.account_type::text = v_root.account_type
      and a.parent_id is null
    order by a.code
    limit 1;

    if v_root_id is null then
      v_candidate := v_root.preferred_code::integer;
      while exists (
        select 1 from public.accounts a
        where a.business_id = p_business_id and a.code = v_candidate::text
      ) loop
        v_candidate := v_candidate + 1;
        if v_candidate > (v_root.preferred_code::integer / 1000) * 1000 + 999 then
          raise exception 'No available account code remains for the % account group.', v_root.name;
        end if;
      end loop;

      insert into public.accounts (
        business_id, code, name, account_type, parent_id, normal_balance, is_system, is_active
      ) values (
        p_business_id,
        v_candidate::text,
        v_root.name,
        v_root.account_type::public.account_type_enum,
        null,
        case when v_root.account_type in ('ASSET', 'EXPENSE', 'COGS') then 'DEBIT' else 'CREDIT' end,
        true,
        true
      )
      returning id into v_root_id;
    end if;
  end loop;

  for v_default in
    select * from (values
      ('1100', 'Cash', 'ASSET', 'DEBIT', 'ASSET'),
      ('1110', 'Cash at Bank', 'ASSET', 'DEBIT', 'ASSET'),
      ('1200', 'Accounts Receivable', 'ASSET', 'DEBIT', 'ASSET'),
      ('1300', 'Inventory', 'ASSET', 'DEBIT', 'ASSET'),
      ('1400', 'Prepaid Expenses', 'ASSET', 'DEBIT', 'ASSET'),
      ('1500', 'Fixed Assets', 'ASSET', 'DEBIT', 'ASSET'),
      ('1590', 'Accumulated Depreciation', 'ASSET', 'CREDIT', 'ASSET'),
      ('2100', 'Accounts Payable', 'LIABILITY', 'CREDIT', 'LIABILITY'),
      ('2200', 'Accrued Expenses', 'LIABILITY', 'CREDIT', 'LIABILITY'),
      ('2300', 'Tax Payable', 'LIABILITY', 'CREDIT', 'LIABILITY'),
      ('2400', 'Loans Payable', 'LIABILITY', 'CREDIT', 'LIABILITY'),
      ('3100', 'Capital', 'EQUITY', 'CREDIT', 'EQUITY'),
      ('3200', 'Retained Earnings', 'EQUITY', 'CREDIT', 'EQUITY'),
      ('4100', 'Sales Revenue', 'REVENUE', 'CREDIT', 'REVENUE'),
      ('4200', 'Service Revenue', 'REVENUE', 'CREDIT', 'REVENUE'),
      ('5100', 'Wages and Salaries', 'EXPENSE', 'DEBIT', 'EXPENSE'),
      ('5200', 'Rent', 'EXPENSE', 'DEBIT', 'EXPENSE'),
      ('5300', 'Utilities', 'EXPENSE', 'DEBIT', 'EXPENSE'),
      ('5400', 'Transport', 'EXPENSE', 'DEBIT', 'EXPENSE'),
      ('5600', 'Bank and Payment Fees', 'EXPENSE', 'DEBIT', 'EXPENSE'),
      ('5700', 'Depreciation Expense', 'EXPENSE', 'DEBIT', 'EXPENSE'),
      ('5800', 'Interest Expense', 'EXPENSE', 'DEBIT', 'EXPENSE')
    ) as defaults(code, name, account_type, normal_balance, parent_type)
  loop
    select a.id into v_parent_id
    from public.accounts a
    where a.business_id = p_business_id
      and a.account_type::text = v_default.parent_type
      and a.parent_id is null
    order by a.code
    limit 1;

    if v_parent_id is null or exists (
      select 1 from public.accounts a
      where a.business_id = p_business_id
        and a.parent_id = v_parent_id
        and a.name = v_default.name
        and a.account_type::text = v_default.account_type
        and a.is_system
    ) then
      continue;
    end if;

    v_candidate := v_default.code::integer;
    v_group_end := (v_candidate / 1000) * 1000 + 999;
    while exists (
      select 1 from public.accounts a
      where a.business_id = p_business_id and a.code = v_candidate::text
    ) loop
      v_candidate := v_candidate + 1;
      if v_candidate > v_group_end then
        raise exception 'No available account code remains for the % account group.', v_default.name;
      end if;
    end loop;

    insert into public.accounts (
      business_id, code, name, account_type, parent_id, normal_balance, is_system, is_active
    ) values (
      p_business_id,
      v_candidate::text,
      v_default.name,
      v_default.account_type::public.account_type_enum,
      v_parent_id,
      v_default.normal_balance,
      true,
      true
    )
    on conflict (business_id, code) do nothing;
  end loop;
end;
$$;

revoke all on function public.ensure_default_coa(uuid) from public;

create or replace function public.seed_business_default_coa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.ensure_default_coa(new.id);
  return new;
end;
$$;

revoke all on function public.seed_business_default_coa() from public;

drop trigger if exists businesses_seed_default_coa on public.businesses;
create trigger businesses_seed_default_coa
after insert on public.businesses
for each row
execute function public.seed_business_default_coa();

do $$
declare
  v_business_id uuid;
begin
  for v_business_id in select b.id from public.businesses b loop
    perform public.ensure_default_coa(v_business_id);
  end loop;
end;
$$;

create or replace function public.enforce_bank_ledger_mapping()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.business_id is not distinct from old.business_id
    and new.type is not distinct from old.type
    and new.account_id is not distinct from old.account_id
  then
    return new;
  end if;

  if new.account_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('bank-ledger:' || new.business_id::text, 0));

  if not exists (
    select 1 from public.accounts a
    where a.id = new.account_id and a.business_id = new.business_id
  ) then
    raise exception 'COA mapping does not belong to this business.';
  end if;

  if not exists (
    select 1 from public.accounts a
    where a.id = new.account_id and a.business_id = new.business_id and a.is_active
  ) then
    raise exception 'COA mapping must be active.';
  end if;

  if new.type = 'BANK' and not exists (
    select 1 from public.accounts a
    where a.id = new.account_id
      and a.business_id = new.business_id
      and a.account_type = 'ASSET'
  ) then
    raise exception 'Bank ledger must be an active asset account in the same business.';
  end if;

  if new.type = 'BANK' and exists (
    select 1 from public.financial_accounts fa
    where fa.business_id = new.business_id
      and fa.type = 'BANK'
      and fa.account_id = new.account_id
      and fa.id is distinct from new.id
  ) then
    raise exception 'Bank ledger is already linked to another bank account.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_bank_ledger_mapping() from public;

drop trigger if exists financial_accounts_bank_ledger_insert on public.financial_accounts;
create trigger financial_accounts_bank_ledger_insert
before insert on public.financial_accounts
for each row
execute function public.enforce_bank_ledger_mapping();

drop trigger if exists financial_accounts_bank_ledger_update on public.financial_accounts;
create trigger financial_accounts_bank_ledger_update
before update of business_id, type, account_id on public.financial_accounts
for each row
execute function public.enforce_bank_ledger_mapping();

create or replace function public.prevent_posted_account_remapping()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.account_id is distinct from old.account_id and exists (
    select 1
    from public.journal_lines jl
    join public.journal_entries je on je.id = jl.journal_entry_id
    where jl.financial_account_id = old.id
      and je.business_id = old.business_id
      and je.status = 'POSTED'
  ) then
    raise exception 'Financial account mapping cannot change after posted journal activity.';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_posted_account_remapping() from public;

drop trigger if exists financial_accounts_posted_mapping_immutable on public.financial_accounts;
create trigger financial_accounts_posted_mapping_immutable
before update of account_id on public.financial_accounts
for each row
execute function public.prevent_posted_account_remapping();

create or replace function public.prevent_opening_balance_edits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.opening_balance is distinct from old.opening_balance
    or new.opening_balance_date is distinct from old.opening_balance_date
  then
    raise exception 'Opening balance requires a balanced posted journal entry.';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_opening_balance_edits() from public;

drop trigger if exists financial_accounts_opening_balance_immutable on public.financial_accounts;
create trigger financial_accounts_opening_balance_immutable
before update of opening_balance, opening_balance_date on public.financial_accounts
for each row
execute function public.prevent_opening_balance_edits();

create or replace function public.prevent_posted_account_structure_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.business_id is distinct from old.business_id then
    raise exception 'Account business cannot change.';
  end if;

  if old.is_system and (
    new.code is distinct from old.code
    or new.name is distinct from old.name
    or new.account_type is distinct from old.account_type
    or new.normal_balance is distinct from old.normal_balance
    or new.parent_id is distinct from old.parent_id
    or new.is_system is distinct from old.is_system
  ) then
    raise exception 'System accounts are protected from unsafe modification.';
  end if;

  if new.parent_id is distinct from old.parent_id
    or new.account_type is distinct from old.account_type
  then
    if new.parent_id is not null and not exists (
      select 1 from public.accounts parent
      where parent.id = new.parent_id
        and parent.business_id = new.business_id
        and parent.account_type = new.account_type
    ) then
      raise exception 'Parent account must belong to this business and account type.';
    end if;

    if new.parent_id is not null and exists (
      with recursive ancestors(id, parent_id) as (
        select parent.id, parent.parent_id
        from public.accounts parent
        where parent.id = new.parent_id and parent.business_id = new.business_id
        union
        select parent.id, parent.parent_id
        from public.accounts parent
        join ancestors on parent.id = ancestors.parent_id
        where parent.business_id = new.business_id
      )
      select 1 from ancestors where id = old.id
    ) then
      raise exception 'Circular parent reference detected.';
    end if;
  end if;

  if new.account_type is distinct from old.account_type and exists (
    select 1 from public.accounts child
    where child.parent_id = old.id and child.business_id = old.business_id
  ) then
    raise exception 'Account type cannot change while child accounts exist.';
  end if;

  if (new.code is distinct from old.code
    or new.name is distinct from old.name
    or new.account_type is distinct from old.account_type
    or new.normal_balance is distinct from old.normal_balance
    or new.parent_id is distinct from old.parent_id
    or new.is_system is distinct from old.is_system)
    and exists (
      select 1
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.journal_entry_id
      where jl.account_id = old.id
        and je.business_id = old.business_id
        and je.status = 'POSTED'
    )
  then
    raise exception 'Account structure cannot change after posted journal activity.';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_posted_account_structure_changes() from public;

drop trigger if exists accounts_posted_structure_immutable on public.accounts;
create trigger accounts_posted_structure_immutable
before update on public.accounts
for each row
execute function public.prevent_posted_account_structure_changes();

create or replace function public.require_balanced_opening_balance_journal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_normal_balance text;
begin
  if coalesce(new.opening_balance, 0) = 0 then
    return new;
  end if;

  select a.normal_balance into v_normal_balance
  from public.accounts a
  where a.id = new.account_id and a.business_id = new.business_id;

  if v_normal_balance is null or not exists (
    select 1
    from public.journal_entries je
    cross join lateral (
      select coalesce(sum(jl.debit), 0) as debit, coalesce(sum(jl.credit), 0) as credit
      from public.journal_lines jl
      where jl.journal_entry_id = je.id
    ) totals
    cross join lateral (
      select coalesce(sum(jl.debit), 0) as debit, coalesce(sum(jl.credit), 0) as credit
      from public.journal_lines jl
      where jl.journal_entry_id = je.id
        and jl.account_id = new.account_id
        and jl.financial_account_id = new.id
    ) mapped
    where je.business_id = new.business_id
      and je.journal_no = 'OB-' || new.id::text
      and je.journal_date = new.opening_balance_date
      and je.status = 'POSTED'
      and totals.debit = totals.credit
      and totals.debit > 0
      and case when v_normal_balance = 'DEBIT'
        then mapped.debit - mapped.credit = new.opening_balance
        else mapped.credit - mapped.debit = new.opening_balance
      end
  ) then
    raise exception 'Opening balance requires a balanced posted journal entry.';
  end if;

  return new;
end;
$$;

revoke all on function public.require_balanced_opening_balance_journal() from public;

drop trigger if exists financial_accounts_opening_balance_journal_required on public.financial_accounts;
create constraint trigger financial_accounts_opening_balance_journal_required
after insert or update of opening_balance, opening_balance_date on public.financial_accounts
deferrable initially deferred
for each row
execute function public.require_balanced_opening_balance_journal();

do $$
declare
  v_financial_account record;
  v_ledger_id uuid;
  v_parent_id uuid;
  v_candidate integer;
begin
  for v_financial_account in
    select fa.*
    from public.financial_accounts fa
    where fa.type = 'BANK' and fa.account_id is null
      and not exists (
        select 1
        from public.journal_lines jl
        join public.journal_entries je on je.id = jl.journal_entry_id
        where jl.financial_account_id = fa.id
          and je.business_id = fa.business_id
          and je.status = 'POSTED'
      )
    order by fa.business_id, fa.id
  loop
    perform public.ensure_default_coa(v_financial_account.business_id);

    select a.id into v_ledger_id
    from public.accounts a
    where a.business_id = v_financial_account.business_id
      and a.account_type = 'ASSET'
      and a.is_active
      and a.parent_id is not null
      and not exists (
        select 1 from public.financial_accounts linked
        where linked.business_id = a.business_id
          and linked.type = 'BANK'
          and linked.account_id = a.id
      )
    order by a.code
    limit 1;

    if v_ledger_id is null then
      select a.id into v_parent_id
      from public.accounts a
      where a.business_id = v_financial_account.business_id
        and a.account_type = 'ASSET'
        and a.parent_id is null
      order by a.code
      limit 1;

      for v_candidate in 1100..1999 loop
        if not exists (
          select 1 from public.accounts a
          where a.business_id = v_financial_account.business_id
            and a.code = v_candidate::text
        ) then
          insert into public.accounts (
            business_id, code, name, account_type, parent_id, normal_balance, is_system, is_active
          ) values (
            v_financial_account.business_id,
            v_candidate::text,
            v_financial_account.name || ' - Cash at Bank',
            'ASSET',
            v_parent_id,
            'DEBIT',
            false,
            true
          )
          returning id into v_ledger_id;
          exit;
        end if;
      end loop;
    end if;

    if v_ledger_id is null then
      raise exception 'Could not assign a bank ledger to financial account %.', v_financial_account.id;
    end if;

    update public.financial_accounts
    set account_id = v_ledger_id
    where id = v_financial_account.id and business_id = v_financial_account.business_id;

    insert into public.audit_logs (business_id, action, entity_type, entity_id, metadata)
    values (
      v_financial_account.business_id,
      'BANK_LEDGER_BACKFILLED',
      'FINANCIAL_ACCOUNT',
      v_financial_account.id,
      jsonb_build_object('account_id', v_ledger_id)
    );
  end loop;
end;
$$;

create or replace function public.create_financial_account_with_ledger(
  p_business_id uuid,
  p_name text,
  p_type public.financial_account_type_enum,
  p_account_code text,
  p_currency text default 'MYR',
  p_status text default 'ACTIVE',
  p_bank_name text default null,
  p_company_name text default null,
  p_account_number text default null,
  p_opening_balance numeric default 0,
  p_opening_balance_date date default current_date,
  p_account_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_financial_account public.financial_accounts%rowtype;
  v_ledger_id uuid;
  v_parent_id uuid;
  v_equity_id uuid;
  v_candidate integer;
  v_journal_result jsonb;
  v_opening_ref text;
  v_normal_balance text;
  v_auto_created boolean := false;
  v_existing_account boolean := false;
begin
  if v_user_id is null or not public.is_business_owner_or_admin(p_business_id) then
    raise exception 'Business owner or admin membership required.';
  end if;

  if nullif(trim(p_name), '') is null or nullif(trim(p_account_code), '') is null then
    raise exception 'Financial account name and code are required.';
  end if;
  if nullif(trim(p_currency), '') is null or upper(p_status) not in ('ACTIVE', 'INACTIVE') then
    raise exception 'Currency and a valid account status are required.';
  end if;
  if coalesce(p_opening_balance, 0) < 0 then
    raise exception 'Opening balance cannot be negative.';
  end if;
  if p_type = 'BANK' and (
    nullif(trim(p_bank_name), '') is null
    or nullif(trim(p_company_name), '') is null
    or nullif(trim(p_account_number), '') is null
  ) then
    raise exception 'Bank name, account holder, and account number are required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('financial-account:' || p_business_id::text, 0));
  perform public.ensure_default_coa(p_business_id);

  select * into v_financial_account
  from public.financial_accounts fa
  where fa.business_id = p_business_id and fa.account_code = trim(p_account_code)
  for update;

  if found then
    v_existing_account := true;
    if v_financial_account.name <> trim(p_name)
      or v_financial_account.type <> p_type
      or v_financial_account.currency <> upper(trim(p_currency))
      or v_financial_account.status <> upper(p_status)
      or v_financial_account.bank_name is distinct from nullif(trim(p_bank_name), '')
      or v_financial_account.company_name is distinct from nullif(trim(p_company_name), '')
      or v_financial_account.account_number is distinct from nullif(trim(p_account_number), '')
      or v_financial_account.opening_balance <> coalesce(p_opening_balance, 0)
    then
      raise exception 'Financial account code % already exists.', trim(p_account_code);
    end if;
    if v_financial_account.account_id is not null or p_type <> 'BANK' then
      return jsonb_build_object(
        'financialAccount', to_jsonb(v_financial_account),
        'openingJournal', null,
        'idempotent', true,
        'autoCreatedLedger', false
      );
    end if;
  end if;

  v_ledger_id := p_account_id;
  if p_type = 'BANK' and v_ledger_id is null then
    select a.id into v_parent_id
    from public.accounts a
    where a.business_id = p_business_id
      and a.account_type = 'ASSET'
      and a.parent_id is null
    order by a.code
    limit 1;

    if v_parent_id is null then
      raise exception 'No asset account group is available for the bank ledger.';
    end if;

    for v_candidate in 1100..1999 loop
      if not exists (
        select 1 from public.accounts a
        where a.business_id = p_business_id and a.code = v_candidate::text
      ) then
        insert into public.accounts (
          business_id, code, name, account_type, parent_id, normal_balance, is_system, is_active
        ) values (
          p_business_id,
          v_candidate::text,
          trim(p_name) || ' - Cash at Bank',
          'ASSET',
          v_parent_id,
          'DEBIT',
          false,
          true
        )
        returning id into v_ledger_id;
        v_auto_created := true;
        exit;
      end if;
    end loop;
    if v_ledger_id is null then
      raise exception 'No available asset account code remains for a bank ledger.';
    end if;
  elsif p_type = 'BANK' then
    if not exists (
      select 1 from public.accounts a
      where a.id = v_ledger_id and a.business_id = p_business_id
        and a.account_type = 'ASSET' and a.is_active
    ) then
      raise exception 'Selected bank ledger must be an active asset account in this business.';
    end if;
  end if;

  if v_ledger_id is not null then
    select a.normal_balance into v_normal_balance
    from public.accounts a
    where a.id = v_ledger_id and a.business_id = p_business_id;
  end if;

  if coalesce(p_opening_balance, 0) > 0 and v_ledger_id is null then
    raise exception 'A ledger mapping is required to post an opening balance.';
  end if;

  if v_financial_account.id is null then
    insert into public.financial_accounts (
      business_id, bank_name, company_name, account_number, name, type, account_code,
      currency, opening_balance, opening_balance_date, status, account_id
    ) values (
      p_business_id,
      nullif(trim(p_bank_name), ''),
      nullif(trim(p_company_name), ''),
      nullif(trim(p_account_number), ''),
      trim(p_name),
      p_type,
      trim(p_account_code),
      upper(trim(p_currency)),
      coalesce(p_opening_balance, 0),
      coalesce(p_opening_balance_date, current_date),
      upper(p_status),
      v_ledger_id
    )
    returning * into v_financial_account;
  else
    update public.financial_accounts fa
    set account_id = v_ledger_id
    where fa.id = v_financial_account.id and fa.business_id = p_business_id
    returning * into v_financial_account;
  end if;

  insert into public.audit_logs (business_id, user_id, action, entity_type, entity_id, metadata)
  values (
    p_business_id,
    v_user_id,
    case when v_existing_account then 'FINANCIAL_ACCOUNT_LEDGER_ASSIGNED' else 'FINANCIAL_ACCOUNT_CREATED' end,
    'FINANCIAL_ACCOUNT',
    v_financial_account.id,
    jsonb_build_object(
      'account_id', v_ledger_id,
      'account_code', v_financial_account.account_code,
      'auto_created_ledger', v_auto_created
    )
  );

  if coalesce(p_opening_balance, 0) > 0 then
    select a.id into v_equity_id
    from public.accounts a
    where a.business_id = p_business_id
      and a.account_type = 'EQUITY'
      and a.is_system
    order by a.code
    limit 1;

    if v_equity_id is null then
      raise exception 'No opening equity account is available for this business.';
    end if;

    v_opening_ref := 'OB-' || v_financial_account.id::text;
    v_journal_result := public.post_accounting_transaction_atomic(
      p_business_id,
      'financial_account_opening:' || v_financial_account.id::text,
      'MONEY_IN',
      coalesce(p_opening_balance_date, current_date),
      'Opening balance for ' || trim(p_name),
      v_opening_ref,
      p_opening_balance,
      v_financial_account.id,
      v_equity_id,
      v_opening_ref,
      'Opening balance for ' || trim(p_name),
      jsonb_build_array(
        jsonb_build_object(
          'account_id', v_ledger_id,
          'financial_account_id', v_financial_account.id,
          'debit', case when v_normal_balance = 'DEBIT' then p_opening_balance else 0 end,
          'credit', case when v_normal_balance = 'CREDIT' then p_opening_balance else 0 end,
          'description', 'Opening balance'
        ),
        jsonb_build_object(
          'account_id', v_equity_id,
          'debit', case when v_normal_balance = 'CREDIT' then p_opening_balance else 0 end,
          'credit', case when v_normal_balance = 'DEBIT' then p_opening_balance else 0 end,
          'description', 'Opening balance'
        )
      )
    );
  end if;

  return jsonb_build_object(
    'financialAccount', to_jsonb(v_financial_account),
    'openingJournal', v_journal_result,
    'idempotent', false,
    'autoCreatedLedger', v_auto_created
  );
end;
$$;

revoke all on function public.create_financial_account_with_ledger(
  uuid, text, public.financial_account_type_enum, text, text, text, text, text, text, numeric, date, uuid
) from public;
grant execute on function public.create_financial_account_with_ledger(
  uuid, text, public.financial_account_type_enum, text, text, text, text, text, text, numeric, date, uuid
) to authenticated;
