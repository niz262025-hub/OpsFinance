import { NextRequest, NextResponse } from 'next/server';
import { redeemMyopsTicket } from '../../../../lib/auth/myops-app-client';
import { requireLinkedFinanceAccount } from '../../../../lib/auth/myops-account-preflight';
import { createLinkedAuthSession } from '../../../../lib/auth/myops-session-issuer';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { getSupabaseServerConfig } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

// Do not consume one-time tickets until identity binding and session issuance exist.
export async function POST(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403, headers });
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'JSON required' }, { status: 415, headers });
  }
  let ticket: unknown;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'ticket')) {
      throw new Error('Invalid request');
    }
    ticket = (body as { ticket: unknown }).ticket;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers });
  }
  if (typeof ticket !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(ticket)) {
    return NextResponse.json({ error: 'Invalid launch ticket' }, { status: 400, headers });
  }
  if (process.env.MYOPS_SSO_ENABLED !== 'true') {
    return NextResponse.json({ error: 'SSO session provisioning is not enabled' }, { status: 503, headers });
  }
  try {
    const redeemed = await redeemMyopsTicket(ticket);
    const userId = await requireLinkedFinanceAccount(redeemed.user_ref);
    const session = await createLinkedAuthSession(userId);
    const { url, anonKey } = getSupabaseServerConfig();
    const response = NextResponse.json({ redirectTo: '/dashboard' }, { headers });
    const client = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items: Array<{ name: string; value: string; options?: CookieOptions }>) => {
          for (const item of items) {
            response.cookies.set(item.name, item.value, { ...item.options, secure: request.nextUrl.protocol === 'https:', path: '/' });
          }
        },
      },
    });
    const result = await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    if (result.error || result.data.user?.id !== userId) {
      throw new Error('Session identity mismatch');
    }
    return response;
  } catch {
    return NextResponse.json({ error: 'Unable to establish OpsFinance session' }, { status: 403, headers });
  }
}
