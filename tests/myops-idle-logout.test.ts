// @vitest-environment node
import {describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('../lib/auth/myops-session',()=>({MYOPS_COOKIE:'__Host-opsfinance-sso',ssoConfig:()=>({appOrigin:'https://finance.example',transport:{origin:'https://portal.example'}})}));
import {POST} from '../app/api/myops/logout/route';

describe('idle logout redirect',()=>{
  it('clears the local HttpOnly session and returns the configured central login',async()=>{
    const result=await POST(new NextRequest('https://finance.example/api/myops/logout',{method:'POST',headers:{origin:'https://finance.example','Content-Type':'application/json'},body:JSON.stringify({reason:'inactivity',next:'https://other.example'})}));
    expect(result.status).toBe(200);expect(await result.json()).toEqual({next:'https://portal.example/login'});
    expect(result.headers.get('set-cookie')).toContain('__Host-opsfinance-sso=;');
    expect(result.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(result.headers.get('set-cookie')).toContain('HttpOnly');
  });
  it('rejects cross-origin logout without clearing cookies',async()=>{
    const result=await POST(new NextRequest('https://finance.example/api/myops/logout',{method:'POST',headers:{origin:'https://other.example'}}));
    expect(result.status).toBe(403);expect(result.headers.get('set-cookie')).toBeNull();
  });
  it('preserves the existing explicit signout destination',async()=>{
    const result=await POST(new NextRequest('https://finance.example/api/myops/logout',{method:'POST',headers:{origin:'https://finance.example'}}));
    expect(await result.json()).toEqual({next:'https://portal.example/dashboard'});
  });
});
