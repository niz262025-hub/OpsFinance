import { generateKeyPairSync } from 'node:crypto';
// @vitest-environment node
import { afterEach,describe,expect,it,vi } from 'vitest';
import { openSession,sealSession,ssoConfig,type AppSession } from '../lib/auth/myops-session';
const secret='k'.repeat(48);
const session:AppSession={version:1,sessionId:'c08f2182-2a66-4fc9-bbe6-02a21da4d759',userRef:'u'.repeat(43),userId:'c08f2182-2a66-4fc9-bbe6-02a21da4d750',businessId:'c08f2182-2a66-4fc9-bbe6-02a21da4d751',accessToken:'server-only-token',expiresAt:Date.now()+60000};
afterEach(()=>vi.unstubAllEnvs());
describe('sealed MYOPS application session',()=>{
 it('roundtrips without exposing token or identity in cookie plaintext',()=>{
  const value=sealSession(session,secret);
  expect(value).not.toContain(session.accessToken);
  expect(openSession(value,secret)).toEqual(session);
  expect(sealSession(session,secret)).not.toBe(value);
 });
 it('rejects tampered, wrong-key, expired and malformed sessions',()=>{
  const value=sealSession(session,secret);
  expect(openSession((value[0]==='A'?'B':'A')+value.slice(1),secret)).toBeNull();
  expect(openSession(value,'z'.repeat(48))).toBeNull();
  expect(openSession(value,secret,session.expiresAt)).toBeNull();
  expect(openSession(sealSession({...session,businessId:'attacker'},secret),secret)).toBeNull();
  expect(openSession(undefined,secret)).toBeNull();
 });
 it('rejects oversized cookies and short encryption keys',()=>{
  expect(()=>sealSession({...session,accessToken:'x'.repeat(5000)},secret)).toThrow();
  expect(()=>sealSession(session,'short')).toThrow();
 });
 it('requires aligned flags, HTTPS origins and a verified production gate',()=>{
  vi.stubEnv('MYOPS_SSO_ENABLED','true');vi.stubEnv('NEXT_PUBLIC_MYOPS_SSO_ENABLED','true');
  vi.stubEnv('OPSFINANCE_ORIGIN','https://finance.example');vi.stubEnv('MYOPS_ORIGIN','https://portal.example');
  vi.stubEnv('MYOPS_APP_PRIVATE_KEY',generateKeyPairSync('ed25519').privateKey.export({type:'pkcs8',format:'pem'}).toString());vi.stubEnv('MYOPS_APP_SESSION_SECRET',secret);vi.stubEnv('VERCEL_ENV','preview');
  expect(ssoConfig().transport.appId).toBe('opsfinance');
  vi.stubEnv('VERCEL_ENV','production');expect(()=>ssoConfig()).toThrow('verified Data API broker gate');
  vi.stubEnv('MYOPS_PRODUCTION_DATA_GATE_VERIFIED','true');expect(ssoConfig().transport.appId).toBe('opsfinance');
  vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('OPSFINANCE_ORIGIN','https://finance.example/path');expect(()=>ssoConfig()).toThrow();
 });
});
