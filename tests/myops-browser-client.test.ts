// @vitest-environment node
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const {stateless,legacy}=vi.hoisted(()=>({stateless:vi.fn(()=>({})),legacy:vi.fn(()=>({}))}));
vi.mock('@supabase/supabase-js',()=>({createClient:stateless}));
vi.mock('@supabase/ssr',()=>({createBrowserClient:legacy}));
beforeEach(()=>{
 vi.resetModules();vi.clearAllMocks();vi.stubEnv('NEXT_PUBLIC_MYOPS_SSO_ENABLED','true');
 vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://database.example');vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','public-key');
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('[]')));
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('SSO browser data client',()=>{
 it('does not use SSR cookie persistence and sends data only through the app proxy',async()=>{
  const {getSupabaseBrowserClient}=await import('../lib/supabase/client');getSupabaseBrowserClient();
  expect(legacy).not.toHaveBeenCalled();
  const options=(stateless.mock.calls as unknown as Array<[string,string,{auth:unknown;global:{fetch:typeof fetch}}]>)[0][2];
  expect(options.auth).toEqual({persistSession:false,autoRefreshToken:false,detectSessionInUrl:false});
  await options.global.fetch('https://database.example/rest/v1/accounts?select=id',{method:'GET'});
  expect(fetch).toHaveBeenCalledWith('/api/myops/data/rest/v1/accounts?select=id',{method:'GET',credentials:'same-origin'});
 });
 it('refuses direct auth, foreign hosts and storage instead of exposing a token',async()=>{
  const {getSupabaseBrowserClient}=await import('../lib/supabase/client');getSupabaseBrowserClient();
  const options=(stateless.mock.calls as unknown as Array<[string,string,{global:{fetch:typeof fetch}}]>)[0][2];
  for(const url of ['https://database.example/auth/v1/token','https://attacker.example/rest/v1/accounts','https://database.example/storage/v1/object']) {
   await expect(options.global.fetch(url)).rejects.toThrow('Unsupported SSO data operation.');
  }
  expect(fetch).not.toHaveBeenCalled();
 });
});
