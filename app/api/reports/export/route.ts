import {NextResponse} from 'next/server';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {assertBusinessMembership} from '@/lib/accounting/server-operations';
import {assertFinanceFeature} from '@/lib/auth/myops-trial-policy';
import {reportCsv} from '@/lib/report-csv';
export const runtime='nodejs';
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store'};
 if(request.headers.get('origin')!==new URL(request.url).origin||!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')??''))return NextResponse.json({error:'Request rejected.'},{status:403,headers});
 try{
  const client:any=await createSupabaseServerClient();const {data:{user},error}=await client.auth.getUser();
  if(error||!user)return NextResponse.json({error:'MYOPS authentication required.'},{status:401,headers});
  assertFinanceFeature(client.myopsTrialAccess??{mode:'paid'},'report_export');
  const raw=await request.text();if(Buffer.byteLength(raw)>1048576)return NextResponse.json({error:'Report too large.'},{status:413,headers});
  const body=JSON.parse(raw);const businessId=String(body.businessId??'');
  await assertBusinessMembership(client,user.id,businessId);
  // Export the report the user is currently viewing; source data is still tenant-scoped.
  const csv=reportCsv(body.report,{business:businessId,report:String(body.label??'Report'),from:String(body.from??''),to:String(body.to??'')});
  return new NextResponse(csv,{headers:{...headers,'Content-Type':'text/csv;charset=utf-8','Content-Disposition':'attachment; filename="opsfinance-report.csv"'}});
 }catch(error){const message=error instanceof Error&&error.message.includes('Upgrade in MYOPS')?error.message:'Report export is unavailable. Reopen MYOPS and try again.';return NextResponse.json({error:message},{status:403,headers});}
}
