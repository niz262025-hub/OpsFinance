// @vitest-environment node
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const {verified}=vi.hoisted(()=>({verified:vi.fn()}));
vi.mock('../lib/auth/myops-server',()=>({verifiedMyopsClient:verified}));
import {GET,POST} from '../app/api/myops/data/[...path]/route';
beforeEach(()=>{
 vi.clearAllMocks();
 for(const [key,value] of Object.entries({MYOPS_SSO_ENABLED:'true',NEXT_PUBLIC_MYOPS_SSO_ENABLED:'true',OPSFINANCE_ORIGIN:'https://finance.example',MYOPS_ORIGIN:'https://portal.example',MYOPS_APP_PRIVATE_KEY:'key',MYOPS_APP_SESSION_SECRET:'k'.repeat(48),VERCEL_ENV:'preview',SUPABASE_URL:'https://database.example',SUPABASE_ANON_KEY:'public-key'}))vi.stubEnv(key,value);
 verified.mockResolvedValue({session:{accessToken:'verified-user-jwt'}});
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('[]',{headers:{'Content-Type':'application/json'}})));
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
const context=(path=['rest','v1','accounts'])=>({params:Promise.resolve({path})});
describe('server-mediated SSO data access',()=>{
 it('uses the RLS user JWT and never forwards caller credentials',async()=>{
  vi.stubEnv('MYOPS_DATA_BROKER_KEY','b'.repeat(48));
  const response=await GET(new NextRequest('https://finance.example/api/myops/data/rest/v1/accounts?select=id',{headers:{Authorization:'Bearer attacker','x-myops-broker-key':'caller-controlled'}}),context());
  expect(response.status).toBe(200);expect(verified).toHaveBeenCalledOnce();
  const [url,options]=vi.mocked(fetch).mock.calls[0];
  expect(url).toBe('https://database.example/rest/v1/accounts?select=id');
  expect(new Headers(options?.headers).get('authorization')).toBe('Bearer verified-user-jwt');
  expect(new Headers(options?.headers).get('x-myops-broker-key')).toBe('b'.repeat(48));
  expect(options).toMatchObject({redirect:'error',cache:'no-store'});
  expect(await response.text()).not.toContain('verified-user-jwt');
  expect(response.headers.get('x-myops-broker-key')).toBeNull();
 });
 it('denies revoked sessions without contacting the data API',async()=>{
  verified.mockRejectedValue(new Error('revoked'));
  expect((await GET(new NextRequest('https://finance.example/api/myops/data/rest/v1/accounts'),context())).status).toBe(401);
  expect(fetch).not.toHaveBeenCalled();
 });
 it('refuses auth/admin endpoints, identity tables, arbitrary RPCs and cross-origin writes',async()=>{
  for(const path of [['auth','v1','admin'],['rest','v1','myops_identity_links'],['rest','v1','rpc','manage_business_membership']]) {
   expect((await GET(new NextRequest('https://finance.example/api/myops/data/blocked'),context(path))).status).toBe(404);
  }
  expect((await POST(new NextRequest('https://finance.example/api/myops/data/rest/v1/accounts',{method:'POST',headers:{Origin:'https://attacker.example'},body:'{}'}),context())).status).toBe(403);
  expect(verified).not.toHaveBeenCalled();
 });
});
