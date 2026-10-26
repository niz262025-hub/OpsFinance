import { NextResponse } from 'next/server';

/**
 * Phase 2 rollout safety gate. Launch tickets must NOT be redeemed until
 * a verified MYOPS user_ref -> Supabase Auth identity binding and RLS-safe
 * session exchange is implemented. Redeeming earlier burns one-time tickets.
 * This handler deliberately issues no session cookie and grants no access.
 */
export async function POST(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return NextResponse.json({ error: 'Invalid request' }, {
      status: 415, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    });
  }
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  // Do not parse or log ticket material while provisioning is incomplete.
  return NextResponse.json(
    { error: 'MYOPS SSO identity binding and tenant-authorized session exchange are not configured.' },
    { status: 503, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } },
  );
}
