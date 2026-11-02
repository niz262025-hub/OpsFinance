// @vitest-environment node
import {expect,it,vi} from 'vitest';
import {installFinanceTrialClient} from '../lib/auth/myops-trial-client';
const access={mode:'trial' as const,trialId:'trial-server',expiresAt:'2099-01-01',policyVersion:1 as const};
it('routes verified trial postings to atomic adapter and rejects cross-business or raw writes',async()=>{
 const raw=vi.fn(),admin={rpc:vi.fn().mockResolvedValue({data:{transaction_id:'new'},error:null})};
 const table={select:vi.fn().mockReturnValue('read'),insert:raw};
 const client={rpc:vi.fn(),from:vi.fn().mockReturnValue(table)};
 installFinanceTrialClient(client,admin,access,'server-user','server-business');
 await client.rpc('post_accounting_transaction_atomic',{p_business_id:'server-business',p_trial_id:'forged'});
 expect(admin.rpc).toHaveBeenCalledWith('opsfinance_trial_post_transaction',expect.objectContaining({p_user_id:'server-user',p_business_id:'server-business',p_trial_id:'trial-server'}));
 await expect(client.rpc('post_accounting_transaction_atomic',{p_business_id:'other'})).rejects.toThrow('Business access denied');
 expect(()=>client.from('transactions').insert({})).toThrow();
 expect(client.from('transactions').select()).toBe('read');
 expect(raw).not.toHaveBeenCalled();
 await expect(client.rpc('unknown',{})).rejects.toThrow();
});
it('preserves paid client and sanitizes trial database errors',async()=>{
 const client={rpc:vi.fn(),from:vi.fn()};const original=client.rpc;
 installFinanceTrialClient(client,{}, {mode:'paid'},'u','b');expect(client.rpc).toBe(original);
 const admin={rpc:vi.fn().mockResolvedValue({error:{message:'private SQL details'}})};
 installFinanceTrialClient(client,admin,access,'u','b');
 const result=await client.rpc('post_accounting_transaction_atomic',{p_business_id:'b'});
 expect(result.error.message).not.toContain('private SQL');
 admin.rpc.mockResolvedValue({error:{message:'Finance trial usage limit reached'}});
 expect((await client.rpc('post_accounting_transaction_atomic',{p_business_id:'b'})).error.message).toContain('Upgrade in MYOPS');
});
it('binds atomic statement imports to the verified server identity and safely reports the two-file limit',async()=>{
 const admin={rpc:vi.fn().mockResolvedValue({data:{statementId:'statement',bankTransactions:[]},error:null})};
 const client:any={rpc:vi.fn(),from:vi.fn()};installFinanceTrialClient(client,admin,access,'u','b');
 await client.myopsTrialImport({business_id:'b',uploaded_by:'u'},[],'hash');
 expect(admin.rpc).toHaveBeenCalledWith('opsfinance_trial_import_statement',expect.objectContaining({p_user_id:'u',p_business_id:'b',p_trial_id:access.trialId}));
 await expect(client.myopsTrialImport({business_id:'other',uploaded_by:'u'},[],'hash')).rejects.toThrow('Business access denied');
 admin.rpc.mockResolvedValue({error:{message:'Finance trial usage limit reached'}});
 await expect(client.myopsTrialImport({business_id:'b',uploaded_by:'u'},[],'hash')).rejects.toThrow('2 files');
});
