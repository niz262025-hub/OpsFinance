// @vitest-environment node
import {expect,it,vi} from 'vitest';
import {postApprovedBankImport} from '../lib/accounting/server-operations';

it('rejects trial import approval before any database read or posting side effect',async()=>{
 const client={myopsTrialAccess:{mode:'trial',trialId:'trial',expiresAt:'2099-01-01',policyVersion:1},from:vi.fn(),rpc:vi.fn()};
 await expect(postApprovedBankImport(client,'user','business','statement','account')).rejects.toThrow('Preview only');
 expect(client.from).not.toHaveBeenCalled();
 expect(client.rpc).not.toHaveBeenCalled();
});
