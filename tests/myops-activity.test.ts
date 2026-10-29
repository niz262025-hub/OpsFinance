// @vitest-environment node
import {afterEach, describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';
const mocks=vi.hoisted(()=>({verify:vi.fn()}));
vi.mock('../lib/auth/myops-server',()=>({verifiedMyopsClient:mocks.verify}));
vi.mock('../lib/auth/myops-session',()=>({ssoConfig:()=>({appOrigin:'https://finance.example'})}));
import {POST} from '../app/api/myops/activity/route';
afterEach(()=>vi.resetAllMocks());
describe('activity endpoint',()=>{
  it('rejects cross-origin and missing-origin requests before touching a session',async()=>{
    for(const origin of [undefined,'https://other.example']) {
      const response=await POST(new NextRequest('https://finance.example/api/myops/activity',{method:'POST',headers:origin?{origin}:{}}));
      expect(response.status).toBe(403);
    }
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it('asserts activity only after server session validation and fails closed',async()=>{
    const req=()=>new NextRequest('https://finance.example/api/myops/activity',{method:'POST',headers:{origin:'https://finance.example'}});
    mocks.verify.mockResolvedValue({});expect((await POST(req())).status).toBe(200);
    expect(mocks.verify).toHaveBeenCalledWith(true);
    mocks.verify.mockRejectedValue(new Error('expired'));expect((await POST(req())).status).toBe(401);
  });
});
