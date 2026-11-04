import {createHash} from 'node:crypto';

export function provisioningProfile(value:unknown) {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('MYOPS company profile is unavailable.');
 const data=value as Record<string,unknown>;
 const name=typeof data.display_name==='string'?data.display_name.trim():'';
 const company=typeof data.company_name==='string'?data.company_name.trim():'';
 if(!name||name.length>100||!company||company.length>160)throw new Error('MYOPS company profile is unavailable.');
 return {name,company};
}

/** Called only with a redeemed server grant and fresh central entitlement. */
export async function provisionFinanceIdentity(admin:any,userRef:string,profile:unknown) {
 if(!/^[A-Za-z0-9_-]{43}$/.test(userRef))throw new Error('Invalid MYOPS identity.');
 const {name,company}=provisioningProfile(profile);
 const digest=createHash('sha256').update(`opsfinance:myops:${userRef}`).digest('hex');
 const id=`${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-8${digest.slice(17,20)}-${digest.slice(20,32)}`;
 const email=`myops-${digest.slice(0,40)}@identity.opsfinance.invalid`;
 // Stable, app-owned identity supports concurrent launches and retries. Never
 // search by user email or attach a pre-existing unrelated Supabase identity.
 let lookup=await admin.auth.admin.getUserById(id);
 if(!lookup.data?.user){
  const created=await admin.auth.admin.createUser({id,email,email_confirm:true,app_metadata:{myops_user_ref:userRef,myops_bridge:'opsfinance-v1'}});
  lookup=created.error?await admin.auth.admin.getUserById(id):created;
 }
 const user=lookup.data?.user;
 if(lookup.error||user?.id!==id||user.email!==email||!user.email_confirmed_at
  ||user.app_metadata?.myops_user_ref!==userRef||user.app_metadata?.myops_bridge!=='opsfinance-v1')throw new Error('MYOPS identity provisioning failed.');
 const result=await admin.rpc('opsfinance_provision_myops_identity',{
  p_user_ref:userRef,p_user_id:id,p_email:email,p_display_name:name,p_company_name:company,
 });
 if(result.error||result.data?.supabase_user_id!==id||!result.data?.business_id)throw new Error('MYOPS company provisioning failed.');
 return result.data as {supabase_user_id:string;business_id:string};
}
