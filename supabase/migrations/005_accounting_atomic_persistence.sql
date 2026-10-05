create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  idempotency_key text not null,
  operation_type text not null default 'ACCOUNTING_POST',
  result_type text not null default 'JOURNAL',
  result_id uuid,
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key, operation_type)
);

create index if not exists idx_idempotency_keys_business_id
  on public.idempotency_keys (business_id);

create or replace function public.get_accounting_idempotency(
  p_business_id uuid,
  p_idempotency_key text,
  p_operation_type text default 'ACCOUNTING_POST'
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select result_id
  from public.idempotency_keys
  where business_id = p_business_id
    and idempotency_key = p_idempotency_key
    and operation_type = p_operation_type
  order by created_at desc
  limit 1;
$$;

create or replace function public.post_accounting_transaction_atomic(
  p_business_id uuid,
  p_idempotency_key text,
  p_transaction_type text,
  p_transaction_date date,
  p_description text,
  p_reference_no text,
  p_amount numeric(18,2),
  p_financial_account_id uuid,
  p_account_id uuid,
  p_journal_no text,
  p_journal_description text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_transaction_id uuid;
  v_transaction_id uuid;
  v_journal_id uuid;
  v_total_debit numeric(18,2) := 0;
  v_total_credit numeric(18,2) := 0;
  v_line jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_business_id is null or trim(p_idempotency_key) = '' then
    raise exception 'Idempotency key is required.';
  end if;

  if not exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = v_user_id
  ) then
    raise exception 'Business access denied';
  end if;

  if exists (
    select 1
    from public.idempotency_keys ik
    where ik.business_id = p_business_id
      and ik.idempotency_key = p_idempotency_key
      and ik.operation_type = 'ACCOUNTING_POST'
  ) then
    select ik.result_id
    into v_existing_transaction_id
    from public.idempotency_keys ik
    where ik.business_id = p_business_id
      and ik.idempotency_key = p_idempotency_key
      and ik.operation_type = 'ACCOUNTING_POST'
    order by ik.created_at desc
    limit 1;

    return jsonb_build_object(
      'status', 'DUPLICATE',
      'transaction_id', v_existing_transaction_id,
      'journal_id', null,
      'idempotent', true
    );
  end if;

  if p_account_id is not null and not exists (
    select 1
    from public.accounts a
    where a.id = p_account_id
      and a.business_id = p_business_id
  ) then
    raise exception 'Account does not belong to this business.';
  end if;

  if p_financial_account_id is not null and not exists (
    select 1
    from public.financial_accounts fa
    where fa.id = p_financial_account_id
      and fa.business_id = p_business_id
      and fa.status = 'ACTIVE'
  ) then
    raise exception 'Financial account does not belong to this business.';
  end if;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    if coalesce((v_line->>'debit')::numeric, 0) > 0 and coalesce((v_line->>'credit')::numeric, 0) > 0 then
      raise exception 'Line cannot have both debit and credit.';
    end if;

    if coalesce((v_line->>'account_id'), '') = '' then
      raise exception 'Journal line is missing an account.';
    end if;

    if not exists (
      select 1
      from public.accounts a
      where a.id = (v_line->>'account_id')::uuid
        and a.business_id = p_business_id
    ) then
      raise exception 'Journal line account does not belong to this business.';
    end if;

    v_total_debit := v_total_debit + coalesce((v_line->>'debit')::numeric, 0);
    v_total_credit := v_total_credit + coalesce((v_line->>'credit')::numeric, 0);
  end loop;

  if v_total_debit <> v_total_credit then
    raise exception 'Journal is unbalanced.';
  end if;

  insert into public.transactions (
    business_id,
    transaction_no,
    transaction_date,
    transaction_type,
    description,
    reference_no,
    amount,
    currency,
    status,
    source,
    financial_account_id,
    created_by
  )
  values (
    p_business_id,
    coalesce(p_reference_no, p_journal_no),
    p_transaction_date,
    p_transaction_type,
    p_description,
    p_reference_no,
    p_amount,
    'MYR',
    'POSTED',
    'MANUAL',
    p_financial_account_id,
    v_user_id
  )
  returning id into v_transaction_id;

  insert into public.journal_entries (
    business_id,
    journal_no,
    journal_date,
    source_type,
    description,
    status,
    posted_at,
    posted_by
  )
  values (
    p_business_id,
    p_journal_no,
    p_transaction_date,
    'MANUAL',
    p_journal_description,
    'POSTED',
    now(),
    v_user_id
  )
  returning id into v_journal_id;

  insert into public.journal_lines (
    journal_entry_id,
    account_id,
    debit,
    credit,
    description,
    financial_account_id
  )
  select
    v_journal_id,
    (line.value->>'account_id')::uuid,
    coalesce((line.value->>'debit')::numeric, 0),
    coalesce((line.value->>'credit')::numeric, 0),
    line.value->>'description',
    nullif(line.value->>'financial_account_id', '')::uuid
  from jsonb_array_elements(p_lines) as line(value);

  insert into public.audit_logs (
    business_id,
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_business_id,
    v_user_id,
    'POST_ACCOUNTING_TRANSACTION',
    'TRANSACTION',
    v_transaction_id,
    jsonb_build_object(
      'journal_id', v_journal_id,
      'idempotency_key', p_idempotency_key,
      'transaction_type', p_transaction_type
    )
  );

  insert into public.idempotency_keys (
    business_id,
    idempotency_key,
    operation_type,
    result_type,
    result_id
  )
  values (
    p_business_id,
    p_idempotency_key,
    'ACCOUNTING_POST',
    'TRANSACTION',
    v_transaction_id
  );

  return jsonb_build_object(
    'status', 'POSTED',
    'transaction_id', v_transaction_id,
    'journal_id', v_journal_id,
    'idempotent', false
  );
end;
$$;
