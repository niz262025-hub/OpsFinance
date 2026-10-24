import { NextRequest, NextResponse } from 'next/server';
import { redeemMyopsTicket } from '../../../../lib/auth/myops-app-client';

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
  // Redeeming now would irreversibly consume a ticket without signing the user in.
  // Keep the server client referenced until the verified identity/session bridge is ready.
  void redeemMyopsTicket;
  return NextResponse.json({ error: 'SSO session provisioning is not enabled' }, { status: 503, headers });
}
