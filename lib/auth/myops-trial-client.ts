import type {FinanceAccess} from './myops-trial-policy';
/** Attach only after server-side MYOPS session, mapping and membership verification. */
export function installFinanceTrialClient(client:any,admin:any,access:FinanceAccess,userId:string,businessId:string){
 if(access.mode!=='trial')return client;
 Object.defineProperty(client,'myopsTrialAccess',{value:access});
 client.myopsTrialImport=async(statement:Record<string,unknown>,rows:unknown[],contentHash:string)=>{
  if(statement.business_id!==businessId||statement.uploaded_by!==userId)throw new Error('Business access denied.');
  const result=await admin.rpc('opsfinance_trial_import_statement',{p_user_id:userId,p_business_id:businessId,p_trial_id:access.trialId,p_expires_at:access.expiresAt,p_statement:statement,p_rows:rows,p_content_hash:contentHash});
  if(result.error)throw new Error(result.error.message==='Finance trial usage limit reached'?'Trial bank statement limit reached (2 files). Upgrade in MYOPS.':'Trial statement import could not be completed.');
  return result.data;
 };
 const originalRpc=client.rpc.bind(client), originalFrom=client.from.bind(client);
 client.rpc=async(name:string,payload:Record<string,unknown>={})=>{
  if(name==='get_accounting_idempotency')return originalRpc(name,payload);
  if(name==='create_financial_account_with_ledger') {
   if(payload.p_business_id!==businessId)throw new Error('Business access denied.');
   if(!Number.isFinite(Number(payload.p_opening_balance??0))||Number(payload.p_opening_balance??0)!==0)throw new Error('Start trial bank accounts with a zero opening balance. Add balances through trial transactions.');
   // The authenticated RPC verifies auth.uid()/owner-admin membership and creates the
   // account and ledger atomically. Zero balance creates no posting or usage unit.
   return originalRpc(name,{...payload,p_business_id:businessId,p_opening_balance:0});
  }
  if(name!=='post_accounting_transaction_atomic')throw new Error('This operation is preview only during your trial. Upgrade in MYOPS.');
  if(payload.p_business_id!==businessId)throw new Error('Business access denied.');
  const result=await admin.rpc('opsfinance_trial_post_transaction',{
   p_user_id:userId,p_business_id:businessId,p_trial_id:access.trialId,p_expires_at:access.expiresAt,p_payload:payload,
  });
  if(result.error)return {data:null,error:{message:result.error.message==='Finance trial usage limit reached'?'Trial limit reached: maximum 30 transactions. Upgrade in MYOPS to continue.':'Trial posting could not be completed. Check MYOPS and retry.'}};
  return result;
 };
 // Basic account setup uses the existing authenticated user's RLS, never admin.
 // Opening balances require atomic journal+quota support before enabling them.
 client.from=(table:string)=>new Proxy(originalFrom(table),{get(target,key,receiver){
  if(key==='insert'&&['accounts','financial_accounts'].includes(table))return (payload:unknown,...args:unknown[])=>{
   const rows=Array.isArray(payload)?payload:[payload];
   if(!rows.length||rows.some(row=>!row||typeof row!=='object'||row.business_id!==businessId))throw new Error('Business access denied.');
   if(table==='financial_accounts'&&rows.some(row=>!Number.isFinite(Number(row.opening_balance??0))||Number(row.opening_balance??0)!==0))throw new Error('Start trial bank accounts with a zero opening balance. Add balances through trial transactions.');
   if(table==='accounts'&&rows.some(row=>row.is_system===true))throw new Error('System account creation is not available during your trial.');
   return Reflect.get(target,'insert',target).call(target,payload,...args);
  };
  if(['insert','update','upsert','delete'].includes(String(key)))return ()=>{throw new Error('This operation is not available during your trial. Manage access in MYOPS.');};
  const value=Reflect.get(target,key,receiver);return typeof value==='function'?value.bind(target):value;
 }});
 return client;
}
