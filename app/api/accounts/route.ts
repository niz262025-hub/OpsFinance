import { NextResponse } from 'next/server';

import { resolveAuthorizedBusinessId } from '@/lib/auth/business';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedBusinessId = searchParams.get('businessId');

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
    requestedBusinessId,
  );

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('business_id', businessId)
    .order('code', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ accounts: data ?? [] });
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

  const payload = await request.json().catch(() => ({}));
  const requestedBusinessId = String(payload.businessId ?? '').trim();

  const { data: membershipRows, error: membershipError } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id);

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 400 });
  }

  const businessId = resolveAuthorizedBusinessId(user.id, membershipRows ?? [], requestedBusinessId);

  const parentId = payload.parent_id ? String(payload.parent_id).trim() || null : null;
  if (parentId) {
    const { data: parentRow, error: parentError } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', parentId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (parentError) {
      return NextResponse.json({ error: parentError.message }, { status: 400 });
    }

    if (!parentRow) {
      return NextResponse.json({ error: 'Parent account is not valid for this business.' }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      business_id: businessId,
      code: payload.code,
      name: payload.name,
      account_type: payload.account_type,
      normal_balance: payload.normal_balance,
      parent_id: parentId,
      is_system: false,
      is_active: payload.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ account: data });
}
