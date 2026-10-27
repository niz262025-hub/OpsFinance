// @vitest-environment node
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { NextRequest } from 'next/server';
const {establish}=vi.hoisted(()=>({establish:vi.fn()}));
vi.mock('../lib/auth/myops-server',()=>({establishMyopsSession:establish}));
import { POST } from '../app/api/myops/launch/route';
const grant={version:1,sessionId:'c08f2182-2a66-4fc9-bbe6-02a21da4d759',userRef:'u'.repeat(43),userId:'c08f2182-2a66-4fc9-bbe6-02a21da4d750',businessId:'c08f2182-2a66-4fc9-bbe6-02a21da4d751',accessToken:'hidden-token',expiresAt:Date.now()+60000};
function request(origin='https://finance.example',body:unknown={ticket:'t'.repeat(43)}){return new NextRequest('https://finance.example/api/myops/launch',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});}
beforeEach(()=>{
 vi.clearAllMocks();
 for(const [key,value] of Object.entries({MYOPS_SSO_ENABLED:'true',NEXT_PUBLIC_MYOPS_SSO_ENABLED:'true',OPSFINANCE_ORIGIN:'https://finance.example',MYOPS_ORIGIN:'https://portal.example',MYOPS_APP_PRIVATE_KEY:'key',MYOPS_APP_SESSION_SECRET:'k'.repeat(48),VERCEL_ENV:'preview'}))vi.stubEnv(key,value);
 establish.mockResolvedValue(grant);
});
afterEach(()=>vi.unstubAllEnvs());
describe('MYOPS launch endpoint',()=>{
 it('sets only a sealed HttpOnly secure host cookie; never returns upstream tokens',async()=>{
  const response=await POST(request());
  expect(response.status).toBe(200);
  const cookie=response.headers.get('set-cookie')??'';
  expect(cookie).toContain('__Host-opsfinance-sso=');expect(cookie).toMatch(/HttpOnly/i);expect(cookie).toMatch(/Secure/i);expect(cookie).toMatch(/SameSite=lax/i);
  expect(cookie).not.toContain('hidden-token');expect(await response.json()).toEqual({ok:true});
 });
 it('rejects CSRF and client-selected identity fields before redemption',async()=>{
  expect((await POST(request('https://attacker.example'))).status).toBe(403);
  expect((await POST(request('https://finance.example',{ticket:'t'.repeat(43),userId:'attacker'}))).status).toBe(400);
  expect(establish).not.toHaveBeenCalled();
 });
 it('fails closed on expired/replayed tickets, revoked entitlement or unmapped identity',async()=>{
  establish.mockRejectedValue(new Error('upstream secret'));
  const response=await POST(request());expect(response.status).toBe(403);expect(response.headers.get('set-cookie')).toBeNull();
  expect(await response.text()).not.toContain('upstream secret');
 });
 it('cannot activate production by setting feature flags',async()=>{
  vi.stubEnv('VERCEL_ENV','production');expect((await POST(request())).status).toBe(403);expect(establish).not.toHaveBeenCalled();
 });
});
