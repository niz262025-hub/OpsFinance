import type {FinanceAccess} from './myops-trial-policy';
/** Attach only after server-side MYOPS session, mapping and membership verification. */
export function installFinanceTrialClient(client:any,admin:any,access:FinanceAccess,userId:string,businessId:string){
 if(access.mode!=='trial')return client;
 const originalRpc=client.rpc.bind(client), originalFrom=client.from.bind(client);
 client.rpc=async(name:string,payload:Record<string,unknown>={})=>{
  if(name==='get_accounting_idempotency')return originalRpc(name,payload);
  if(name!=='post_accounting_transaction_atomic')throw new Error('This operation is preview only during your trial. Upgrade in MYOPS.');
  if(payload.p_business_id!==businessId)throw new Error('Business access denied.');
  const result=await admin.rpc('opsfinance_trial_post_transaction',{
   p_user_id:userId,p_business_id:businessId,p_trial_id:access.trialId,p_expires_at:access.expiresAt,p_payload:payload,
  });
  if(result.error)return {data:null,error:{message:result.error.message==='Finance trial usage limit reached'?'Trial limit reached: maximum 30 transactions. Upgrade in MYOPS to continue.':'Trial posting could not be completed. Check MYOPS and retry.'}};
  return result;
 };
 // Until upload/other adapters are integrated, no trial can reach raw paid writes.
 client.from=(table:string)=>new Proxy(originalFrom(table),{get(target,key,receiver){
  if(['insert','update','upsert','delete'].includes(String(key)))return ()=>{throw new Error('This operation is not available during your trial. Manage access in MYOPS.');};
  const value=Reflect.get(target,key,receiver);return typeof value==='function'?value.bind(target):value;
 }});
 return client;
}
