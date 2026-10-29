// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({client:vi.fn(),membership:vi.fn(),persist:vi.fn(),approve:vi.fn()}));
vi.mock('../lib/supabase/server',()=>({createSupabaseServerClient:mocks.client}));
vi.mock('../lib/accounting/server-operations',()=>({assertBusinessMembership:mocks.membership,persistBankStatementImport:mocks.persist,postApprovedBankImport:mocks.approve}));
import {POST} from '../app/api/upload/route';
afterEach(()=>vi.resetAllMocks());
const request=(financialAccountId?:string)=>new Request('https://finance.example/api/upload',{method:'POST',headers:{origin:'https://finance.example','content-type':'application/json'},body:JSON.stringify({businessId:'business-1',action:'preview',content:'dummy csv',financialAccountId})});
it('rejects missing bank selection before an import can choose a default account',async()=>{
  mocks.client.mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'user-1'}}})}});
  expect((await POST(request())).status).toBe(400);
  expect(mocks.persist).not.toHaveBeenCalled();
});
it('forwards explicit bank selection and preserves rejection of unauthorized accounts',async()=>{
  const client={auth:{getUser:async()=>({data:{user:{id:'user-1'}}})}};
  mocks.client.mockResolvedValue(client);
  mocks.persist.mockResolvedValue({statementId:'s1',rows:[]});
  expect((await POST(request('bank-2'))).status).toBe(200);
  expect(mocks.persist).toHaveBeenCalledWith(client,'user-1','business-1','upload.csv','dummy csv','text/csv','bank-2');
  mocks.persist.mockRejectedValue(new Error('The selected financial account is not active for this business.'));
  expect((await POST(request('other-business-bank'))).status).toBe(400);
});
