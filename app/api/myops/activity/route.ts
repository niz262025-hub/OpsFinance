import { NextRequest, NextResponse } from 'next/server';
import { verifiedMyopsClient } from '@/lib/auth/myops-server';
import { ssoConfig } from '@/lib/auth/myops-session';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const headers = {'Cache-Control':'no-store'};
  try {
    const {appOrigin} = ssoConfig();
    if (request.nextUrl.origin !== appOrigin || request.headers.get('origin') !== appOrigin
        || request.headers.get('sec-fetch-site') === 'cross-site') {
      return NextResponse.json({error:'Request rejected.'}, {status:403,headers});
    }
    await verifiedMyopsClient(true);
    return NextResponse.json({active:true}, {headers});
  } catch {
    return NextResponse.json({error:'MYOPS authentication required.'}, {status:401,headers});
  }
}
