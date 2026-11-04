// @vitest-environment node
import {generateKeyPairSync} from 'node:crypto';
import {expect,it,vi,afterEach} from 'vitest';
afterEach(()=>vi.unstubAllEnvs());
import {checkMyopsEntitlement} from '../lib/auth/myops-transport';
const pair=generateKeyPairSync('ed25519');
const config={origin:'https://myops.example',appId:'opsfinance',keyVersion:'current' as const,privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'}).toString()};
const session='11111111-1111-4111-8111-111111111111';
it('preserves verified paid access but refuses trials until atomic Finance limits are ready',async()=>{
 for(const mode of [undefined,'paid']) {
  const fetcher=async()=>new Response(JSON.stringify({entitled:true,session_active:true,access_mode:mode}));
  await expect(checkMyopsEntitlement(config,session,false,fetcher as typeof fetch)).resolves.toEqual({mode:'paid'});
 }
 for(const extra of [{access_mode:'trial'},{trial:{id:session}},{access_mode:'unknown'},{session_active:false},{entitled:false}]) {
  const fetcher=async()=>new Response(JSON.stringify({entitled:true,session_active:true,...extra}));
  await expect(checkMyopsEntitlement(config,session,false,fetcher as typeof fetch)).rejects.toThrow();
 }
});

it('only accepts trial metadata behind the explicit Preview gate',async()=>{
 const data={entitled:true,session_active:true,access_mode:'trial',trial:{id:session,expires_at:'2099-01-01T00:00:00Z',policy_version:1}};
 const transport=async()=>new Response(JSON.stringify(data));
 vi.stubEnv('OPSFINANCE_TRIAL_POSTING_READY','true');vi.stubEnv('VERCEL_ENV','production');
 await expect(checkMyopsEntitlement(config,session,false,transport as typeof fetch)).rejects.toThrow();
 vi.stubEnv('VERCEL_ENV','preview');
 await expect(checkMyopsEntitlement(config,session,false,transport as typeof fetch)).resolves.toMatchObject({mode:'trial',trialId:session});
});
