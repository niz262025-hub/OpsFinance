import { NextResponse } from 'next/server';

import { resolveAuthorizedBusinessId, resolveBusinessContextForUser } from '@/lib/auth/business';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedBusinessId = searchParams.get('businessId');
  const context = await resolveBusinessContextForUser(supabase, user.id, requestedBusinessId);

  if (!context || context.state !== 'BUSINESS_CONTEXT_READY') {
    return NextResponse.json({ error: context?.state === 'NO_BUSINESS' ? 'NO_BUSINESS' : 'UNAUTHORIZED_BUSINESS' }, { status: 403 });
  }

  const businessId = context.businessId;

  const [accountsResult, financialAccountsResult, transactionsResult] = await Promise.all([
    supabase.from('accounts').select('*').eq('business_id', businessId).order('code', { ascending: true }),
    supabase.from('financial_accounts').select('*').eq('business_id', businessId).order('name', { ascending: true }),
    supabase.from('transactions').select('*').eq('business_id', businessId).order('transaction_date', { ascending: false }).limit(20),
  ]);

  if (accountsResult.error) {
    return NextResponse.json({ error: accountsResult.error.message }, { status: 400 });
  }

  if (financialAccountsResult.error) {
    return NextResponse.json({ error: financialAccountsResult.error.message }, { status: 400 });
  }

  if (transactionsResult.error) {
    return NextResponse.json({ error: transactionsResult.error.message }, { status: 400 });
  }

  return NextResponse.json({
    accounts: accountsResult.data ?? [],
    financialAccounts: financialAccountsResult.data ?? [],
    transactions: transactionsResult.data ?? [],
  });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const requestedBusinessId = String(payload.businessId ?? payload.p_business_id ?? '').trim();

  const { data: membershipRows, error: membershipError } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id);

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 400 });
  }

  const businessId = resolveAuthorizedBusinessId(user.id, membershipRows ?? [], requestedBusinessId);

  const accountId = String(payload.account_id ?? payload.p_account_id ?? '').trim();
  const financialAccountId = String(payload.financial_account_id ?? payload.p_financial_account_id ?? '').trim();
  const amountValue = Number(payload.amount ?? payload.p_amount ?? 0);
  const transactionType = String(payload.type ?? payload.p_transaction_type ?? 'MONEY_IN').trim().toUpperCase();

  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    return NextResponse.json({ error: 'Transaction amount must be a positive number.' }, { status: 400 });
  }

  if (!accountId) {
    return NextResponse.json({ error: 'A valid counter-account is required for this posting.' }, { status: 400 });
  }

  if (!financialAccountId) {
    return NextResponse.json({ error: 'A valid financial account is required.' }, { status: 400 });
  }

  const { data: accountRow, error: accountError } = await supabase
    .from('accounts')
    .select('id, business_id')
    .eq('id', accountId)
    .eq('business_id', businessId)
    .maybeSingle();

  if (accountError) {
    return NextResponse.json({ error: accountError.message }, { status: 400 });
  }

  if (!accountRow) {
    return NextResponse.json({ error: 'General ledger account is not valid for this business.' }, { status: 400 });
  }

  const { data: financialRow, error: financialError } = await supabase
    .from('financial_accounts')
    .select('*')
    .eq('id', financialAccountId)
    .eq('business_id', businessId)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (financialError) {
    return NextResponse.json({ error: financialError.message }, { status: 400 });
  }

  if (!financialRow) {
    return NextResponse.json({ error: 'Financial account is not valid for this business.' }, { status: 400 });
  }

  const mappedLedgerAccountId = String(financialRow.account_id ?? '').trim();
  if (!mappedLedgerAccountId) {
    return NextResponse.json({ error: 'Selected financial account is not mapped to a valid cash/bank general ledger account.' }, { status: 400 });
  }

  const { data: mappedLedgerRow, error: mappedLedgerError } = await supabase
    .from('accounts')
    .select('id, business_id')
    .eq('id', mappedLedgerAccountId)
    .eq('business_id', businessId)
    .maybeSingle();

  if (mappedLedgerError) {
    return NextResponse.json({ error: mappedLedgerError.message }, { status: 400 });
  }

  if (!mappedLedgerRow) {
    return NextResponse.json({ error: 'Selected financial account map does not belong to this business.' }, { status: 400 });
  }

  if (accountId === mappedLedgerAccountId) {
    return NextResponse.json({ error: 'Counter account must be different from the selected cash/bank account.' }, { status: 400 });
  }

  const lineOne = transactionType === 'MONEY_IN'
    ? { account_id: mappedLedgerAccountId, debit: amountValue.toFixed(2), description: payload.description ?? payload.p_description ?? 'Money in posting' }
    : { account_id: accountId, debit: amountValue.toFixed(2), description: payload.description ?? payload.p_description ?? 'Money out posting' };

  const lineTwo = transactionType === 'MONEY_IN'
    ? { account_id: accountId, credit: amountValue.toFixed(2), description: payload.description ?? payload.p_description ?? 'Money in posting' }
    : { account_id: mappedLedgerAccountId, credit: amountValue.toFixed(2), description: payload.description ?? payload.p_description ?? 'Money out posting' };

  const rpcPayload = {
    p_business_id: businessId,
    p_idempotency_key: payload.idempotency_key ?? payload.p_idempotency_key ?? `server-${Date.now()}`,
    p_transaction_type: transactionType,
    p_transaction_date: payload.date ?? payload.p_transaction_date ?? new Date().toISOString().slice(0, 10),
    p_description: payload.description ?? payload.p_description ?? 'Server-posted transaction',
    p_reference_no: payload.reference_no ?? payload.p_reference_no ?? `SRV-${Date.now()}`,
    p_amount: amountValue,
    p_financial_account_id: financialAccountId,
    p_account_id: accountId,
    p_journal_no: payload.journal_no ?? payload.p_journal_no ?? `SRV-${Date.now()}`,
    p_journal_description: payload.journal_description ?? payload.p_journal_description ?? payload.description ?? payload.p_description ?? 'Server-posted transaction',
    p_lines: payload.lines ?? payload.p_lines ?? [lineOne, lineTwo],
  };

  const { data, error: rpcError } = await supabase.rpc('post_accounting_transaction_atomic', rpcPayload);

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 400 });
  }

  return NextResponse.json({ transaction: data ?? null });
}
