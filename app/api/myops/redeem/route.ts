import { NextRequest, NextResponse } from 'next/server';
import { redeemMyopsTicket } from '../../../lib/auth/myops-app-client';

export const runtime = 'nodejs';

// This endpoint only validates and redeems the single-use MYOPS ticket.
// It does not create an OpsFinance user session or authorize dashboard access.
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
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid');
    const fields = Object.keys(body);
    if (fields.length !== 1 || fields[0] !== 'ticket') throw new Error('invalid');
    ticket = (body as { ticket: unknown }).ticket;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers });
  }
  if (typeof ticket !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(ticket)) {
    return NextResponse.json({ error: 'Invalid launch ticket' }, { status: 400, headers });
  }
  try {
    await redeemMyopsTicket(ticket);
    // Identity binding and Supabase session issuance are not implemented yet.
    // Fail closed rather than accidentally treating a redeemed ticket as a login.
    return NextResponse.json({ error: 'SSO session provisioning is not enabled' }, { status: 503, headers });
  } catch {
    return NextResponse.json({ error: 'Launch validation unavailable' }, { status: 503, headers });
  }
}
