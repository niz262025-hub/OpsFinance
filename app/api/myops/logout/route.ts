import { NextRequest,NextResponse } from 'next/server';
import { MYOPS_COOKIE,ssoConfig } from '@/lib/auth/myops-session';
export const runtime='nodejs';
export async function POST(request:NextRequest) {
  try {
    const {appOrigin,transport}=ssoConfig();
    if(request.headers.get('origin')!==appOrigin||request.nextUrl.origin!==appOrigin)return NextResponse.json({error:'Request rejected.'},{status:403});
    const body = await request.json().catch(() => null);
    const destination = body?.reason === 'inactivity' ? '/login' : '/dashboard';
    const response=NextResponse.json({next:`${transport.origin}${destination}`},{headers:{'Cache-Control':'no-store'}});
    response.cookies.set(MYOPS_COOKIE,'',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});
    // MYOPS owns the central logout POST. The portal dashboard supplies that action;
    // navigating by GET must not silently log the user out or claim global revocation.
    return response;
  }catch{return NextResponse.json({error:'SSO is unavailable.'},{status:503});}
}
