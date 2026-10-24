import { describe, expect, it, vi } from 'vitest';

import { isPreviewAuthBypassEnabled, navigateToDashboard, navigateToLogin, navigateToMyOpsHome } from '../lib/auth/navigation';

describe('auth navigation', () => {
  it('never bypasses authentication in Vercel preview or production', () => {
    vi.stubEnv('NEXT_PUBLIC_PREVIEW_AUTH_BYPASS', 'true');
    vi.stubEnv('PREVIEW_AUTH_BYPASS', 'true');
    for (const environment of ['preview', 'production']) {
      vi.stubEnv('VERCEL_ENV', environment);
      expect(isPreviewAuthBypassEnabled()).toBe(false);
    }
    vi.unstubAllEnvs();
  });

  it('requires an explicit opt-in and development runtime for local bypass', () => {
    vi.stubEnv('VERCEL_ENV', 'development');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_PREVIEW_AUTH_BYPASS', 'false');
    expect(isPreviewAuthBypassEnabled()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_PREVIEW_AUTH_BYPASS', 'true');
    expect(isPreviewAuthBypassEnabled()).toBe(true);
    vi.stubEnv('NODE_ENV', 'production');
    expect(isPreviewAuthBypassEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });

  it('uses a full document navigation to the dashboard', () => {
    const assign = vi.fn();

    navigateToDashboard(assign);

    expect(assign).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith('/dashboard');
  });

  it('routes users back to the MyOps login portal after sign-out', () => {
    const assign = vi.fn();

    navigateToLogin(assign);
    expect(assign).toHaveBeenCalledWith('/login');

    const home = vi.fn();
    navigateToMyOpsHome(home);
    expect(home).toHaveBeenCalledWith('/');
  });
});
