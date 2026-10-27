import { NextRequest, NextResponse } from 'next/server';
import { verifiedMyopsClient } from '@/lib/auth/myops-server';
import { ssoConfig } from '@/lib/auth/myops-session';
import { myopsBrokerHeaders } from '@/lib/auth/myops-broker';
export const runtime='nodejs';
const TABLES=new Set(['users','businesses','business_members','financial_accounts','accounts','transactions','journal_entries','journal_lines','accounting_periods','accounting_rules','bank_statements','bank_transactions','reconciliation_matches','attachments','audit_logs']);
const RPCS=new Set(['post_accounting_transaction_atomic','get_accounting_idempotency']);
async function handler(request:NextRequest,context:{params:Promise<{path:string[]}>}) {
  const responseHeaders={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
  try {
    const {appOrigin}=ssoConfig();
    if (request.nextUrl.origin!==appOrigin || (request.headers.get('origin') && request.headers.get('origin')!==appOrigin)
      || request.headers.get('sec-fetch-site')==='cross-site') return NextResponse.json({error:'Request rejected.'},{status:403,headers:responseHeaders});
    if (!['GET','HEAD'].includes(request.method) && request.headers.get('origin')!==appOrigin) return NextResponse.json({error:'Request rejected.'},{status:403,headers:responseHeaders});
    const {path}=await context.params;
    if (path[0]!=='rest'||path[1]!=='v1'||!(path.length===3&&TABLES.has(path[2])||path.length===4&&path[2]==='rpc'&&RPCS.has(path[3]))) return NextResponse.json({error:'Unknown data operation.'},{status:404,headers:responseHeaders});
    const {session}=await verifiedMyopsClient();
    const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key=process.env.SUPABASE_ANON_KEY??process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if(!url||!key) throw new Error();
    const headers=new Headers({...myopsBrokerHeaders(),apikey:key,Authorization:`Bearer ${session.accessToken}`});
    for(const name of ['accept','content-type','prefer','range','range-unit']) {const value=request.headers.get(name);if(value)headers.set(name,value);}
    const body=['GET','HEAD'].includes(request.method)?undefined:await request.text();
    if(body && Buffer.byteLength(body)>1048576)return NextResponse.json({error:'Request too large.'},{status:413,headers:responseHeaders});
    const upstream=await fetch(`${url}/${path.join('/')}${request.nextUrl.search}`,{method:request.method,headers,body,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
    const outgoing=new Headers(responseHeaders);
    for(const name of ['content-type','content-range','range-unit','preference-applied']) {const value=upstream.headers.get(name);if(value)outgoing.set(name,value);}
    return new NextResponse(request.method==='HEAD'||upstream.status===204?null:upstream.body,{status:upstream.status,headers:outgoing});
  } catch {return NextResponse.json({error:'MYOPS authentication required.'},{status:401,headers:responseHeaders});}
}
export const GET=handler;
export const HEAD=handler;
export const POST=handler;
export const PATCH=handler;
export const DELETE=handler;
