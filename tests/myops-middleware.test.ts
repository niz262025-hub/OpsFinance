// @vitest-environment node
import {generateKeyPairSync} from 'node:crypto';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const {check}=vi.hoisted(()=>({check:vi.fn()}));
vi.mock('../lib/auth/myops-transport',()=>({checkMyopsEntitlement:check}));
import {middleware} from '../middleware';
import {MYOPS_COOKIE,sealSession,type AppSession} from '../lib/auth/myops-session';
const secret='k'.repeat(48);
const session:AppSession={version:1,sessionId:'c08f2182-2a66-4fc9-bbe6-02a21da4d759',userRef:'u'.repeat(43),userId:'c08f2182-2a66-4fc9-bbe6-02a21da4d750',businessId:'c08f2182-2a66-4fc9-bbe6-02a21da4d751',accessToken:'private-jwt',expiresAt:Date.now()+60000};
beforeEach(()=>{
 vi.clearAllMocks();check.mockResolvedValue(undefined);
 for(const [key,value] of Object.entries({MYOPS_SSO_ENABLED:'true',NEXT_PUBLIC_MYOPS_SSO_ENABLED:'true',OPSFINANCE_ORIGIN:'https://finance.example',MYOPS_ORIGIN:'https://portal.example',MYOPS_APP_PRIVATE_KEY:generateKeyPairSync('ed25519').privateKey.export({type:'pkcs8',format:'pem'}).toString(),MYOPS_APP_SESSION_SECRET:secret,VERCEL_ENV:'preview'}))vi.stubEnv(key,value);
});
afterEach(()=>vi.unstubAllEnvs());
function request(path:string,cookie?:string){return new NextRequest(`https://finance.example${path}`,{headers:cookie?{cookie:`${MYOPS_COOKIE}=${cookie}`}:{}});}
describe('SSO middleware boundary',()=>{
 it('requires the sealed SSO session, preserves refresh and rechecks central authorization',async()=>{
  expect((await middleware(request('/dashboard'))).headers.get('location')).toBe('https://portal.example/login');
  expect((await middleware(request('/dashboard',sealSession(session,secret)))).status).toBe(200);
  expect(check).toHaveBeenCalledWith(expect.anything(),session.sessionId,false);
 });
 it('denies revoked sessions on pages and APIs',async()=>{
  check.mockRejectedValue(new Error('revoked'));
  expect((await middleware(request('/dashboard',sealSession(session,secret)))).status).toBe(307);
  expect((await middleware(request('/api/accounts',sealSession(session,secret)))).status).toBe(401);
 });
 it('replaces local sign-in with the fixed MYOPS account destination',async()=>{
  expect((await middleware(request('/login?next=https://attacker.example'))).headers.get('location')).toBe('https://portal.example/login');
 });
});
