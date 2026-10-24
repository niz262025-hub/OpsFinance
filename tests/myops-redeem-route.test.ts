// @vitest-environment node

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { redeemMock, linkedAccountMock, linkedSessionMock, createServerClientMock, getConfigMock } = vi.hoisted(() => ({
  redeemMock: vi.fn(),
  linkedAccountMock: vi.fn(),
  linkedSessionMock: vi.fn(),
  createServerClientMock: vi.fn(),
  getConfigMock: vi.fn(),
}));

vi.mock('../lib/auth/myops-app-client', () => ({ redeemMyopsTicket: redeemMock }));
vi.mock('../lib/auth/myops-account-preflight', () => ({ requireLinkedFinanceAccount: linkedAccountMock }));
vi.mock('../lib/auth/myops-session-issuer', () => ({ createLinkedAuthSession: linkedSessionMock }));
vi.mock('../lib/supabase/server', () => ({ getSupabaseServerConfig: getConfigMock }));
vi.mock('@supabase/ssr', () => ({
  createServerClient: createServerClientMock,
}));

import { POST } from '../app/api/myops/redeem/route';

const ticket = 'a'.repeat(43);

function launchRequest(body: unknown = { ticket }) {
  return new NextRequest('https://finance.example/api/myops/redeem', {
    method: 'POST',
    headers: { origin: 'https://finance.example', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('MYOPS redemption route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('MYOPS_SSO_ENABLED', 'true');
    redeemMock.mockResolvedValue({
      session_id: '8dcf91a8-15e3-4322-96e8-c195c15ed673',
      user_ref: 'b'.repeat(43),
      product: 'opsfinance',
    });
    linkedAccountMock.mockResolvedValue('user-id');
    linkedSessionMock.mockResolvedValue({ access_token: 'access', refresh_token: 'refresh' });
    getConfigMock.mockReturnValue({ url: 'https://example.supabase.co', anonKey: 'publishable-key' });
    createServerClientMock.mockImplementation((_url, _key, options) => ({
      auth: {
        setSession: async () => {
          options.cookies.setAll([{ name: 'sb-access-token', value: 'supabase-session', options: { path: '/' } }]);
          return { data: { user: { id: 'user-id' } }, error: null };
        },
      },
    }));
  });

  afterEach(() => vi.unstubAllEnvs());

  it('sets the opaque MYOPS session in a secure HttpOnly host cookie after linked auth succeeds', async () => {
    const response = await POST(launchRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirectTo: '/dashboard' });
    expect(response.cookies.get('__Host-opsfinance-myops-session')?.value).toBe('8dcf91a8-15e3-4322-96e8-c195c15ed673');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('Secure');
    expect(response.headers.get('set-cookie')).toContain('SameSite=lax');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('does not redeem one-time tickets while OpsFinance SSO is disabled', async () => {
    vi.stubEnv('MYOPS_SSO_ENABLED', 'false');

    const response = await POST(launchRequest());

    expect(response.status).toBe(503);
    expect(redeemMock).not.toHaveBeenCalled();
  });
});
