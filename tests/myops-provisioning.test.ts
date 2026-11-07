// @vitest-environment node
import {expect,it,vi} from 'vitest';
import {provisionFinanceIdentity,provisioningProfile} from '../lib/auth/myops-provisioning';

it('accepts descriptive labels only and rejects missing or oversized company names',()=>{
 expect(provisioningProfile({display_name:' Owner ',company_name:' Company ',role:'admin'})).toEqual({name:'Owner',company:'Company'});
 for(const value of [null,{},[],{display_name:'Owner',company_name:'x'.repeat(161)}])expect(()=>provisioningProfile(value)).toThrow();
});
it('creates only an app-owned identity and retries without creating another user',async()=>{
 let user:any;const getUserById=vi.fn(async()=>({data:{user},error:user?null:{message:'missing'}}));
 const createUser=vi.fn(async(args:any)=>{user={...args,email_confirmed_at:'2026-01-01'};return {data:{user},error:null};});
 const rpc=vi.fn(async(_name:string,args:any)=>({data:{supabase_user_id:args.p_user_id,business_id:'business'},error:null}));
 const admin={auth:{admin:{getUserById,createUser}},rpc};
 for(let i=0;i<2;i++)await provisionFinanceIdentity(admin,'u'.repeat(43),{display_name:'Owner',company_name:'Company'});
 expect(createUser).toHaveBeenCalledTimes(1);
 expect(rpc).toHaveBeenCalledWith('opsfinance_provision_myops_identity',expect.objectContaining({p_user_ref:'u'.repeat(43),p_company_name:'Company'}));
 expect(user.email).toMatch(/@identity\.opsfinance\.invalid$/);
});
it('refuses an unrelated identity occupying the deterministic id',async()=>{
 const rpc=vi.fn(),createUser=vi.fn();
 const admin={auth:{admin:{getUserById:vi.fn(async(id:string)=>({data:{user:{id,email:'unrelated@example.com',app_metadata:{}}},error:null})),createUser}},rpc};
 await expect(provisionFinanceIdentity(admin,'u'.repeat(43),{display_name:'Owner',company_name:'Company'})).rejects.toThrow('provisioning failed');
 expect(createUser).not.toHaveBeenCalled();expect(rpc).not.toHaveBeenCalled();
});
