import { NextRequest, NextResponse } from 'next/server';
import { establishMyopsSession } from '@/lib/auth/myops-server';
import { MYOPS_COOKIE, sealSession, ssoConfig } from '@/lib/auth/myops-session';
export const runtime='nodejs';
export async function POST(request:NextRequest) {
  const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
  try {
    const config=ssoConfig();
    if (request.headers.get('origin') !== config.appOrigin || new URL(request.url).origin !== config.appOrigin
      || !/^application\/json(?:;|$)/i.test(request.headers.get('content-type')??'')) return NextResponse.json({error:'Request rejected.'},{status:403,headers});
    const text=await request.text();
    if (text.length>1000) return NextResponse.json({error:'Invalid request.'},{status:400,headers});
    const body=JSON.parse(text);
    if (!body || Object.keys(body).length!==1 || typeof body.ticket!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(body.ticket)) return NextResponse.json({error:'Invalid request.'},{status:400,headers});
    const session=await establishMyopsSession(body.ticket);
    const response=NextResponse.json({ok:true},{headers});
    response.cookies.set(MYOPS_COOKIE,sealSession(session,config.secret),{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:Math.max(0,Math.floor((session.expiresAt-Date.now())/1000))});
    return response;
  } catch (error) {
    if (process.env.VERCEL_ENV === 'preview') {
      const reason = error instanceof Error ? error.message : '';
      const allowed = new Set(['SSO is not enabled for this deployment.','Invalid SSO origin.','SSO configuration is incomplete.','SSO identity bridge is not configured.','No authorized identity mapping.','Mapped identity is unavailable.','Identity exchange failed.','Business access denied.','MYOPS access could not be verified.','MYOPS access denied.','Invalid MYOPS grant.']);
      console.warn('myops_launch_rejected', allowed.has(reason) ? reason : 'unclassified');
    }
    return NextResponse.json({error:'MYOPS launch could not be verified.'},{status:403,headers});
  }
}
