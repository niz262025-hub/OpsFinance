import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createBrowserClientMock } = vi.hoisted(() => ({
  createBrowserClientMock: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: createBrowserClientMock,
}));

describe('Supabase browser client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'publishable-test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the same configured browser client without recreating it', async () => {
    const client = { auth: {} };
    createBrowserClientMock.mockReturnValue(client);
    const { getSupabaseBrowserClient } = await import('../lib/supabase/client');

    const first = getSupabaseBrowserClient();
    const second = getSupabaseBrowserClient();

    expect(first).toBe(client);
    expect(second).toBe(first);
    expect(createBrowserClientMock).toHaveBeenCalledOnce();
    expect(createBrowserClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'publishable-test-key',
      { global: { fetch } },
    );
  });

  it('returns null when public browser configuration is missing', async () => {
    const { getSupabaseBrowserClient } = await import('../lib/supabase/client');

    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    expect(getSupabaseBrowserClient()).toBeNull();
    expect(createBrowserClientMock).not.toHaveBeenCalled();
  });

  it('returns null when the public project URL is missing', async () => {
    const { getSupabaseBrowserClient } = await import('../lib/supabase/client');

    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    expect(getSupabaseBrowserClient()).toBeNull();
    expect(createBrowserClientMock).not.toHaveBeenCalled();
  });
});
