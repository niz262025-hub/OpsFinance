import { afterEach, describe, expect, it, vi } from 'vitest';

import { isPreviewAuthBypassEnabled } from '../lib/auth/navigation';

describe('preview authentication bypass safety', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('denies bypass on Vercel preview even when explicitly requested', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('PREVIEW_AUTH_BYPASS', 'true');
    expect(isPreviewAuthBypassEnabled()).toBe(false);
  });

  it('denies bypass in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('PREVIEW_AUTH_BYPASS', 'true');
    expect(isPreviewAuthBypassEnabled()).toBe(false);
  });

  it('requires an explicit opt-in for local development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', '');
    vi.stubEnv('PREVIEW_AUTH_BYPASS', 'false');
    expect(isPreviewAuthBypassEnabled()).toBe(false);
    vi.stubEnv('PREVIEW_AUTH_BYPASS', 'true');
    expect(isPreviewAuthBypassEnabled()).toBe(true);
  });
});
