// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({client:vi.fn(),membership:vi.fn(),persist:vi.fn(),approve:vi.fn()}));
vi.mock('../lib/supabase/server',()=>({createSupabaseServerClient:mocks.client}));
vi.mock('../lib/accounting/server-operations',()=>({assertBusinessMembership:mocks.membership,persistBankStatementImport:mocks.persist,postApprovedBankImport:mocks.approve}));
import {GET, POST} from '../app/api/upload/route';
afterEach(()=>vi.resetAllMocks());
const request=(financialAccountId?:string)=>new Request('https://finance.example/api/upload',{method:'POST',headers:{origin:'https://finance.example','content-type':'application/json'},body:JSON.stringify({businessId:'business-1',action:'preview',content:'dummy csv',financialAccountId})});
const getRequest=()=>new Request('https://finance.example/api/upload?businessId=business-1',{method:'GET'});
it('rejects unauthenticated upload requests',async()=>{
  mocks.client.mockResolvedValue({auth:{getUser:async()=>({data:{user:null},error:null})}});
  expect((await POST(request('bank-2'))).status).toBe(401);
  expect(mocks.persist).not.toHaveBeenCalled();
});
it('rejects authenticated non-members and allows valid members',async()=>{
  const client={auth:{getUser:async()=>({data:{user:{id:'user-1'}}})}};
  mocks.client.mockResolvedValue(client);
  mocks.membership.mockRejectedValue(new Error('Business access denied.'));
  expect((await POST(request('bank-2'))).status).toBe(400);
  mocks.membership.mockResolvedValue(undefined);
  mocks.persist.mockResolvedValue({statementId:'s1',rows:[]});
  expect((await POST(request('bank-2'))).status).toBe(200);
  expect(mocks.persist).toHaveBeenCalledWith(client,'user-1','business-1','upload.csv','dummy csv','text/csv','bank-2');
});
it('rejects business B from reading business A upload metadata and data',async()=>{
  const client={
    auth:{getUser:async()=>({data:{user:{id:'user-2'}}})},
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(async () => ({ data: [], error: null })),
        })),
      })),
    })),
  };
  mocks.client.mockResolvedValue(client);
  mocks.membership.mockRejectedValue(new Error('Business access denied.'));
  const response=await GET(getRequest());
  expect(response.status).toBe(403);
  const payload=await response.json();
  expect(payload.error).toBe('Business access denied.');
});
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
