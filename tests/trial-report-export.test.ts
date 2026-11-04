// @vitest-environment node
import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({client:vi.fn(),membership:vi.fn()}));
vi.mock('../lib/supabase/server',()=>({createSupabaseServerClient:mocks.client}));
vi.mock('../lib/accounting/server-operations',()=>({assertBusinessMembership:mocks.membership}));
import {POST} from '../app/api/reports/export/route';
beforeEach(()=>{vi.clearAllMocks();mocks.membership.mockResolvedValue(undefined);});
const request=()=>new Request('https://finance.test/api/reports/export',{method:'POST',headers:{origin:'https://finance.test','Content-Type':'application/json'},body:JSON.stringify({businessId:'own-business',report:{amount:10},label:'P&L'})});
it('rejects trial export server-side even if client sends a valid report',async()=>{
 mocks.client.mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'user'}}})},myopsTrialAccess:{mode:'trial'}});
 const response=await POST(request());expect(response.status).toBe(403);expect((await response.json()).error).toContain('Upgrade in MYOPS');expect(mocks.membership).not.toHaveBeenCalled();
});
it('retains paid exports only after membership validation',async()=>{
 mocks.client.mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'user'}}})}});
 const response=await POST(request());expect(response.status).toBe(200);expect(response.headers.get('content-type')).toContain('text/csv');expect(mocks.membership).toHaveBeenCalledWith(expect.anything(),'user','own-business');
 mocks.membership.mockRejectedValue(new Error('Private SQL detail'));const denied=await POST(request());expect(denied.status).toBe(403);expect(await denied.text()).not.toContain('Private SQL');
});
it('rejects cross-origin and unauthenticated export',async()=>{
 expect((await POST(new Request('https://finance.test/api/reports/export',{method:'POST'}))).status).toBe(403);
 mocks.client.mockResolvedValue({auth:{getUser:async()=>({data:{user:null}})}});expect((await POST(request())).status).toBe(401);
});
