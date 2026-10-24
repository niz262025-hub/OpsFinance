// @vitest-environment node

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createServerClientMock, getUserMock, verifyMyopsSessionMock, cookieAdapter } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  getUserMock: vi.fn(),
  verifyMyopsSessionMock: vi.fn(),
  cookieAdapter: { current: null as null | { getAll: () => Array<{ name: string; value: string }>; setAll: (cookies: Array<{ name: string; value: string; options?: { path?: string } }>) => void } },
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: createServerClientMock,
}));

vi.mock('../lib/auth/myops-app-client', () => ({
  verifyMyopsAppSession: verifyMyopsSessionMock,
}));

import { middleware } from '../middleware';

describe('auth middleware session boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyMyopsSessionMock.mockResolvedValue(false);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'publishable-test-key');
    cookieAdapter.current = null;
    createServerClientMock.mockImplementation((_url, _key, options) => {
      cookieAdapter.current = options.cookies;
      return { auth: { getUser: getUserMock } };
    });
    getUserMock.mockResolvedValue({ data: { user: null } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('redirects protected routes without a user to the MyOps login portal', async () => {
    const response = await middleware(new NextRequest('http://localhost/dashboard'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/login');
  });

  it('does not bypass authentication on Vercel preview', async () => {
    vi.stubEnv('NEXT_PUBLIC_PREVIEW_AUTH_BYPASS', 'true');
    vi.stubEnv('VERCEL_ENV', 'preview');
    const root = await middleware(new NextRequest('http://localhost/'));
    const login = await middleware(new NextRequest('http://localhost/login'));
    const opsfinance = await middleware(new NextRequest('http://localhost/opsfinance'));
    expect(root.status).toBe(200);
    expect(login.status).toBe(200);
    expect(opsfinance.status).toBe(307);
    expect(opsfinance.headers.get('location')).toBe('http://localhost/login');
  });

  it('limits the explicit local demo bypass to the isolated demo API', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('PREVIEW_AUTH_BYPASS', 'true');
    vi.stubEnv('VERCEL_ENV', '');

    const demoApi = await middleware(new NextRequest('http://localhost/api/preview/data'));
    expect(demoApi.status).toBe(200);
    expect(getUserMock).not.toHaveBeenCalled();

    const dashboard = await middleware(new NextRequest('http://localhost/dashboard'));
    expect(dashboard.status).toBe(307);
    expect(dashboard.headers.get('location')).toBe('http://localhost/login');
    expect(getUserMock).toHaveBeenCalledOnce();
  });

  it('never bypasses Production authentication even when both preview flags are set', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_PREVIEW_AUTH_BYPASS', 'true');
    vi.stubEnv('PREVIEW_AUTH_BYPASS', 'true');
    const response = await middleware(new NextRequest('https://app.myops.com.my/dashboard'));
    expect(response.headers.get('location')).toBe('https://app.myops.com.my/login');
    expect(getUserMock).toHaveBeenCalledOnce();
  });

  it('missing configuration leads protected pages to an accessible login instead of a root loop', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_ANON_KEY', '');
    const protectedPage = await middleware(new NextRequest('https://app.myops.com.my/dashboard'));
    expect(protectedPage.headers.get('location')).toBe('https://app.myops.com.my/login');
    const login = await middleware(new NextRequest('https://app.myops.com.my/login'));
    expect(login.status).toBe(200);
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('allows protected routes when getUser returns a user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'test-user' } } });

    const response = await middleware(new NextRequest('http://localhost/dashboard'));

    expect(response.status).toBe(200);
  });

  it('requires an active MYOPS app session before allowing a protected page', async () => {
    vi.stubEnv('MYOPS_SSO_ENABLED', 'true');
    getUserMock.mockResolvedValue({ data: { user: { id: 'test-user' } } });
    verifyMyopsSessionMock.mockResolvedValue(true);

    const request = new NextRequest('https://app.myops.com.my/dashboard', {
      headers: { cookie: '__Host-opsfinance-myops-session=8dcf91a8-15e3-4322-96e8-c195c15ed673' },
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(verifyMyopsSessionMock).toHaveBeenCalledWith('8dcf91a8-15e3-4322-96e8-c195c15ed673', true, false);
  });

  it('denies protected API routes when the MYOPS app session is missing', async () => {
    vi.stubEnv('MYOPS_SSO_ENABLED', 'true');
    getUserMock.mockResolvedValue({ data: { user: { id: 'test-user' } } });

    const response = await middleware(new NextRequest('https://app.myops.com.my/api/transactions', { method: 'POST' }));

    expect(response.status).toBe(401);
    expect(response.headers.get('location')).toBeNull();
    expect(verifyMyopsSessionMock).not.toHaveBeenCalled();
  });

  it('marks protected data mutations as sensitive MYOPS checks', async () => {
    vi.stubEnv('MYOPS_SSO_ENABLED', 'true');
    getUserMock.mockResolvedValue({ data: { user: { id: 'test-user' } } });
    verifyMyopsSessionMock.mockResolvedValue(true);

    const request = new NextRequest('https://app.myops.com.my/api/transactions', {
      method: 'POST',
      headers: { cookie: '__Host-opsfinance-myops-session=8dcf91a8-15e3-4322-96e8-c195c15ed673' },
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(verifyMyopsSessionMock).toHaveBeenCalledWith('8dcf91a8-15e3-4322-96e8-c195c15ed673', true, true);
  });

  it('keeps the ticket redemption endpoint public while MYOPS SSO is required', async () => {
    vi.stubEnv('MYOPS_SSO_ENABLED', 'true');

    const response = await middleware(new NextRequest('https://app.myops.com.my/api/myops/redeem', { method: 'POST' }));

    expect(response.status).toBe(200);
    expect(verifyMyopsSessionMock).not.toHaveBeenCalled();
  });

  it('fails closed to MYOPS SSO in production when the feature flag is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('MYOPS_SSO_ENABLED', '');
    getUserMock.mockResolvedValue({ data: { user: { id: 'test-user' } } });

    const response = await middleware(new NextRequest('https://app.myops.com.my/dashboard'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://app.myops.com.my/login?reason=myops-session');
    expect(response.headers.get('set-cookie')).toContain('__Host-opsfinance-myops-session=');
    expect(verifyMyopsSessionMock).not.toHaveBeenCalled();
  });

  it('keeps the root MyOps portal accessible without a user', async () => {
    const response = await middleware(new NextRequest('http://localhost/'));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('keeps the root MyOps portal accessible to an authenticated user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'test-user' } } });

    const response = await middleware(new NextRequest('http://localhost/'));

    expect(response.status).toBe(200);
  });

  it('renders login for signed-out visitors and redirects signed-in visitors to dashboard', async () => {
    const response = await middleware(new NextRequest('http://localhost/login'));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();

    getUserMock.mockResolvedValue({ data: { user: { id: 'test-user' } } });
    const authenticatedResponse = await middleware(new NextRequest('http://localhost/login'));

    expect(authenticatedResponse.status).toBe(307);
    expect(authenticatedResponse.headers.get('location')).toBe('http://localhost/dashboard');
  });

  it('redirects the OpsFinance entrypoint to the dashboard when authenticated and to MyOps when unauthenticated', async () => {
    const unauthenticated = await middleware(new NextRequest('http://localhost/opsfinance'));
    expect(unauthenticated.status).toBe(307);
    expect(unauthenticated.headers.get('location')).toBe('http://localhost/login');

    getUserMock.mockResolvedValue({ data: { user: { id: 'test-user' } } });
    const authenticated = await middleware(new NextRequest('http://localhost/opsfinance'));
    expect(authenticated.status).toBe(307);
    expect(authenticated.headers.get('location')).toBe('http://localhost/dashboard');
  });

  it('passes request cookies to Supabase and writes refreshed cookies to the response', async () => {
    getUserMock.mockImplementation(async () => {
      const incoming = cookieAdapter.current?.getAll() ?? [];
      expect(incoming).toContainEqual({ name: 'sb-test-auth-token', value: 'incoming-cookie' });
      cookieAdapter.current?.setAll([
        { name: 'sb-test-auth-token', value: 'refreshed-cookie', options: { path: '/' } },
      ]);
      return { data: { user: { id: 'test-user' } } };
    });
    const request = new NextRequest('http://localhost/dashboard', {
      headers: { cookie: 'sb-test-auth-token=incoming-cookie' },
    });

    const response = await middleware(request);

    expect(request.cookies.get('sb-test-auth-token')?.value).toBe('refreshed-cookie');
    expect(response.cookies.get('sb-test-auth-token')?.value).toBe('refreshed-cookie');
  });
});
