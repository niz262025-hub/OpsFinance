// @vitest-environment node
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({create:vi.fn(),redeem:vi.fn(),check:vi.fn(),cookies:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:mocks.create}));
vi.mock('next/headers',()=>({cookies:mocks.cookies}));
vi.mock('../lib/auth/myops-transport',()=>({redeemMyopsTicket:mocks.redeem,checkMyopsEntitlement:mocks.check}));
import {establishMyopsSession,verifiedMyopsClient} from '../lib/auth/myops-server';
import {sealSession,type AppSession} from '../lib/auth/myops-session';
const userId='c08f2182-2a66-4fc9-bbe6-02a21da4d750';
const businessId='c08f2182-2a66-4fc9-bbe6-02a21da4d751';
const sessionId='c08f2182-2a66-4fc9-bbe6-02a21da4d759';
const user={id:userId,email:'verified@test.invalid',email_confirmed_at:'2026-01-01T00:00:00Z'};
const query=(data:unknown)=>{const q={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data,error:null})};q.select.mockReturnValue(q);q.eq.mockReturnValue(q);return q;};
let mapping:ReturnType<typeof query>;let member:ReturnType<typeof query>;let admin:any;let client:any;
beforeEach(()=>{
 vi.clearAllMocks();
 for(const [key,value] of Object.entries({MYOPS_SSO_ENABLED:'true',NEXT_PUBLIC_MYOPS_SSO_ENABLED:'true',OPSFINANCE_ORIGIN:'https://finance.example',MYOPS_ORIGIN:'https://portal.example',MYOPS_APP_PRIVATE_KEY:'key',MYOPS_APP_SESSION_SECRET:'k'.repeat(48),VERCEL_ENV:'preview',SUPABASE_URL:'https://database.example',SUPABASE_ANON_KEY:'public-key',SUPABASE_SERVICE_ROLE_KEY:'admin-secret'}))vi.stubEnv(key,value);
 mapping=query({supabase_user_id:userId,business_id:businessId});member=query({business_id:businessId});
 admin={from:vi.fn(()=>mapping),auth:{admin:{getUserById:vi.fn().mockResolvedValue({data:{user},error:null}),generateLink:vi.fn().mockResolvedValue({data:{user,properties:{hashed_token:'server-otp'}},error:null})}}};
 client={from:vi.fn(()=>member),auth:{verifyOtp:vi.fn().mockResolvedValue({data:{user,session:{access_token:'user-jwt',expires_at:Math.floor(Date.now()/1000)+3600}},error:null}),getUser:vi.fn().mockResolvedValue({data:{user},error:null})}};
 mocks.create.mockImplementation((_url,key)=>key==='admin-secret'?admin:client);
 mocks.redeem.mockResolvedValue({session_id:sessionId,user_ref:'u'.repeat(43),product:'opsfinance',max_session_seconds:43200});
 mocks.check.mockResolvedValue(undefined);
});
afterEach(()=>vi.unstubAllEnvs());
describe('MYOPS identity to RLS-user bridge',()=>{
 it('only mints a session for the preprovisioned, confirmed identity and membership',async()=>{
  const session=await establishMyopsSession('t'.repeat(43));
  expect(mapping.eq).toHaveBeenCalledWith('user_ref','u'.repeat(43));expect(mapping.eq).toHaveBeenCalledWith('enabled',true);
  expect(admin.auth.admin.getUserById).toHaveBeenCalledWith(userId);
  expect(client.auth.verifyOtp).toHaveBeenCalledWith({type:'magiclink',token_hash:'server-otp'});
  expect(session).toMatchObject({userId,businessId,accessToken:'user-jwt'});
  expect(mocks.check).toHaveBeenCalledWith(expect.anything(),sessionId,true);
 });
 it('refuses unmapped identities and never falls back to matching an email',async()=>{
  mapping.maybeSingle.mockResolvedValue({data:null,error:null});
  await expect(establishMyopsSession('t'.repeat(43))).rejects.toThrow('No authorized identity mapping.');
  expect(admin.auth.admin.generateLink).not.toHaveBeenCalled();expect(client.auth.verifyOtp).not.toHaveBeenCalled();
 });
 it('rejects exchanged-user mismatch and absent membership',async()=>{
  client.auth.verifyOtp.mockResolvedValueOnce({data:{user:{...user,id:businessId},session:{access_token:'wrong-jwt',expires_at:9999999999}},error:null});
  await expect(establishMyopsSession('t'.repeat(43))).rejects.toThrow('Identity exchange failed.');
  member.maybeSingle.mockResolvedValue({data:null,error:null});
  await expect(establishMyopsSession('t'.repeat(43))).rejects.toThrow('Business access denied.');
 });
 it('revalidates central entitlement, identity mapping and membership on data access',async()=>{
  const session:AppSession={version:1,sessionId,userRef:'u'.repeat(43),userId,businessId,accessToken:'user-jwt',expiresAt:Date.now()+60000};
  mocks.cookies.mockResolvedValue({get:()=>({value:sealSession(session,'k'.repeat(48))})});
  expect((await verifiedMyopsClient()).user.id).toBe(userId);
  expect(mocks.create).toHaveBeenCalledWith('https://database.example','public-key',expect.objectContaining({global:{headers:{Authorization:'Bearer user-jwt'}}}));
  mapping.maybeSingle.mockResolvedValue({data:{supabase_user_id:businessId,business_id:businessId},error:null});
  await expect(verifiedMyopsClient()).rejects.toThrow('Identity mapping revoked.');
 });
 it('still denies access if entitlement, identity or membership checks fail',async()=>{
  const session:AppSession={version:1,sessionId,userRef:'u'.repeat(43),userId,businessId,accessToken:'user-jwt',expiresAt:Date.now()+60000};
  mocks.cookies.mockResolvedValue({get:()=>({value:sealSession(session,'k'.repeat(48))})});
  mocks.check.mockRejectedValueOnce(new Error('Entitlement denied'));
  await expect(verifiedMyopsClient()).rejects.toThrow('Entitlement denied');
  client.auth.getUser.mockResolvedValueOnce({data:{user:null},error:new Error('Invalid token')});
  await expect(verifiedMyopsClient()).rejects.toThrow('Local identity is no longer valid.');
  member.maybeSingle.mockResolvedValueOnce({data:null,error:null});
  await expect(verifiedMyopsClient()).rejects.toThrow('Business membership revoked.');
 });
});
