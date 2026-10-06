import { NextResponse } from 'next/server';

import { resolveAuthorizedBusinessId } from '@/lib/auth/business';
import { createSupabaseServerClient } from '@/lib/supabase/server';

async function getResolvedBusinessId(request: Request, userId: string) {
  const supabase = createSupabaseServerClient();
  const { data: membershipRows, error: membershipError } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('user_id', userId);

  if (membershipError) {
    throw new Error(membershipError.message ?? 'Business membership lookup failed.');
  }

  const requestedBusinessId = new URL(request.url).searchParams.get('businessId') ?? null;
  return resolveAuthorizedBusinessId(userId, membershipRows ?? [], requestedBusinessId);
}

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const businessId = await getResolvedBusinessId(request, user.id);
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
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json().catch(() => ({}));
    const { data: membershipRows, error: membershipError } = await supabase
      .from('business_members')
      .select('business_id')
      .eq('user_id', user.id);

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 400 });
    }

    const businessId = resolveAuthorizedBusinessId(
      user.id,
      membershipRows ?? [],
      String(payload.businessId ?? '').trim() || null,
    );

    const accountId = payload.accountId ? String(payload.accountId).trim() || null : null;
    if (accountId) {
      const { data: accountRow, error: accountError } = await supabase
        .from('accounts')
        .select('id')
        .eq('id', accountId)
        .eq('business_id', businessId)
        .maybeSingle();

      if (accountError) {
        return NextResponse.json({ error: accountError.message }, { status: 400 });
      }

      if (!accountRow) {
        return NextResponse.json({ error: 'Chart-of-accounts mapping is not valid for this business.' }, { status: 400 });
      }
    }

    const name = String(payload.name ?? '').trim();
    const accountCode = String(payload.accountCode ?? '').trim();
    if (!name || !accountCode) {
      return NextResponse.json({ error: 'Name and account code are required.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('financial_accounts')
      .insert({
        business_id: businessId,
        name,
        type: String(payload.type ?? 'BANK'),
        account_code: accountCode,
        currency: String(payload.currency ?? 'MYR').toUpperCase(),
        opening_balance: Number(payload.openingBalance ?? 0),
        opening_balance_date: payload.openingBalanceDate ? String(payload.openingBalanceDate) : null,
        status: String(payload.status ?? 'ACTIVE'),
        account_id: accountId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ financialAccount: data });
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : 'Business access denied.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
