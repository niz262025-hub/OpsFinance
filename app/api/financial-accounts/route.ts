import { normalizeAccountNumber } from '@/lib/accounting/statement-account';
import { NextResponse } from 'next/server';

import { resolveAuthorizedBusinessId } from '@/lib/auth/business';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const VALID_FINANCIAL_TYPES = new Set(['BANK', 'CASH', 'E_WALLET', 'CREDIT_CARD', 'LOAN', 'OTHER']);
const VALID_STATUS_VALUES = new Set(['ACTIVE', 'INACTIVE']);

async function getAuthorizedBusinessId(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, requestedBusinessId: string | null) {
  const { data: membershipRows, error: membershipError } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('user_id', userId);

  if (membershipError) {
    throw new Error(membershipError.message ?? 'Business membership lookup failed.');
  }

  return resolveAuthorizedBusinessId(userId, membershipRows ?? [], requestedBusinessId);
}

async function getFinancialAccountById(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, businessId: string, id: string) {
  const { data, error } = await supabase
    .from('financial_accounts')
    .select('*')
    .eq('business_id', businessId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? 'Financial account lookup failed.');
  }

  return data;
}

function validateFinancialAccountPayload(payload: Record<string, unknown>, existing?: Record<string, unknown> | null) {
  const name = String(payload.name ?? existing?.name ?? '').trim();
  const accountCode = String(payload.accountCode ?? payload.account_code ?? existing?.account_code ?? '').trim();
  const currency = String(payload.currency ?? payload.currency_code ?? existing?.currency ?? 'MYR').trim().toUpperCase() || 'MYR';
  const type = String(payload.type ?? existing?.type ?? 'BANK').trim().toUpperCase();
  const status = String(payload.status ?? existing?.status ?? 'ACTIVE').trim().toUpperCase();
  const openingBalance = payload.openingBalance ?? payload.opening_balance ?? existing?.opening_balance ?? '0';

  if (!VALID_FINANCIAL_TYPES.has(type)) {
    throw new Error('Financial account type is invalid.');
  }

  if (!VALID_STATUS_VALUES.has(status)) {
    throw new Error('Status must be ACTIVE or INACTIVE.');
  }

  if (!name) {
    throw new Error('Financial account name is required.');
  }

  if (!accountCode) {
    throw new Error('Financial account code is required.');
  }

  const bankName = String(payload.bankName ?? existing?.bank_name ?? '').trim();
  const companyName = String(payload.companyName ?? existing?.company_name ?? '').trim();
  const rawNumber = String(payload.accountNumber ?? existing?.account_number ?? '').trim();
  const accountNumber = rawNumber ? normalizeAccountNumber(rawNumber) : null;
  if (type === 'BANK' && (!bankName || !companyName || !accountNumber)) throw new Error('Bank name, company/account holder name and full account number are required.');
  if (bankName.length > 150 || companyName.length > 200) throw new Error('Bank or company name is too long.');
  const parsedOpeningBalance = Number(openingBalance ?? 0);
  if (!Number.isFinite(parsedOpeningBalance) || parsedOpeningBalance < 0) {
    throw new Error('Opening balance must be a non-negative amount.');
  }

  return {
    bankName, companyName, accountNumber,
    name,
    type,
    accountCode,
    currency,
    status,
    openingBalance: parsedOpeningBalance,
    openingBalanceDate: payload.openingBalanceDate ? String(payload.openingBalanceDate) : ((existing?.opening_balance_date as string | undefined) ?? null),
    accountId: payload.accountId ? String(payload.accountId).trim() || null : (payload.account_id ? String(payload.account_id).trim() || null : (existing?.account_id as string | null | undefined) ?? null),
  };
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const requestedBusinessId = searchParams.get('businessId') ?? null;
    const requestedId = searchParams.get('id') ?? null;
    const businessId = await getAuthorizedBusinessId(supabase, user.id, requestedBusinessId);

    if (requestedId) {
      const account = await getFinancialAccountById(supabase, businessId, requestedId);
      if (!account) {
        return NextResponse.json({ error: 'Financial account not found.' }, { status: 404 });
      }

      return NextResponse.json({ financialAccount: account });
    }

    const { data, error } = await supabase
      .from('financial_accounts')
      .select('*')
      .eq('business_id', businessId)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ financialAccounts: data ?? [] });
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : 'Business access denied.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
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

  try {
    const payload = await request.json().catch(() => ({}));
    const businessId = await getAuthorizedBusinessId(supabase, user.id, String(payload.businessId ?? '').trim() || null);
    const validation = validateFinancialAccountPayload(payload as Record<string, unknown>);
    const { data, error } = await supabase.rpc('create_financial_account_with_ledger', {
      p_business_id: businessId,
      p_name: validation.name,
      p_type: validation.type,
      p_account_code: validation.accountCode,
      p_currency: validation.currency,
      p_status: validation.status,
      p_bank_name: validation.bankName || null,
      p_company_name: validation.companyName || null,
      p_account_number: validation.accountNumber,
      p_opening_balance: validation.openingBalance,
      p_opening_balance_date: validation.openingBalanceDate,
      p_account_id: validation.accountId,
    });

    if (error) {
      const status = error.message?.includes('already exists') ? 409 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json(data);
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : 'Business access denied.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json().catch(() => ({}));
    const targetId = String(payload.id ?? '').trim();
    const businessId = await getAuthorizedBusinessId(supabase, user.id, String(payload.businessId ?? '').trim() || null);

    if (!targetId) {
      return NextResponse.json({ error: 'Financial account id is required.' }, { status: 400 });
    }

    const existing = await getFinancialAccountById(supabase, businessId, targetId);
    if (!existing) {
      return NextResponse.json({ error: 'Financial account not found.' }, { status: 404 });
    }

    const validation = validateFinancialAccountPayload(payload as Record<string, unknown>, existing);

    const openingBalanceWasProvided = payload.openingBalance !== undefined || payload.opening_balance !== undefined;
    const openingDateWasProvided = payload.openingBalanceDate !== undefined || payload.opening_balance_date !== undefined;
    if (
      (openingBalanceWasProvided && validation.openingBalance !== Number(existing.opening_balance ?? 0))
      || (openingDateWasProvided && validation.openingBalanceDate !== existing.opening_balance_date)
    ) {
      return NextResponse.json({ error: 'Opening balances can only be changed through a balanced journal entry.' }, { status: 400 });
    }

    if (validation.accountId) {
      const { data: accountRow, error: accountError } = await supabase
        .from('accounts')
        .select('id, account_type, is_active')
        .eq('id', validation.accountId)
        .eq('business_id', businessId)
        .maybeSingle();

      if (accountError) {
        return NextResponse.json({ error: accountError.message }, { status: 400 });
      }

      if (!accountRow || !accountRow.is_active || (validation.type === 'BANK' && accountRow.account_type !== 'ASSET')) {
        return NextResponse.json({ error: 'Chart-of-accounts mapping is not valid for this business.' }, { status: 400 });
      }

      const { data: linkedRow, error: linkedError } = await supabase
        .from('financial_accounts')
        .select('id')
        .eq('business_id', businessId)
        .eq('account_id', validation.accountId)
        .eq('type', 'BANK')
        .neq('id', targetId)
        .maybeSingle();

      if (linkedError) {
        return NextResponse.json({ error: linkedError.message }, { status: 400 });
      }
      if (validation.type === 'BANK' && linkedRow) {
        return NextResponse.json({ error: 'Bank ledger is already linked to another bank account.' }, { status: 409 });
      }
    }

    const { data: duplicateRow, error: duplicateError } = await supabase
      .from('financial_accounts')
      .select('id')
      .eq('business_id', businessId)
      .eq('account_code', validation.accountCode)
      .neq('id', targetId)
      .maybeSingle();

    if (duplicateError) {
      return NextResponse.json({ error: duplicateError.message }, { status: 400 });
    }

    if (duplicateRow) {
      return NextResponse.json({ error: `Financial account code ${validation.accountCode} already exists.` }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('financial_accounts')
      .update({
        bank_name: validation.bankName || null,
        company_name: validation.companyName || null,
        account_number: validation.accountNumber,
        name: validation.name,
        type: validation.type,
        account_code: validation.accountCode,
        currency: validation.currency,
        status: validation.status,
        account_id: validation.accountId,
      })
      .eq('id', targetId)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ financialAccount: data });
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : 'Unable to update financial account.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  return PUT(request);
}
