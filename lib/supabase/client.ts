import { createBrowserClient } from '@supabase/ssr';

export type SupabaseBrowserClient = ReturnType<typeof createBrowserClient>;

let browserClient: SupabaseBrowserClient | null = null;

export function assertNoServiceRoleKeyInBrowser(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const browserServiceRole = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  if (browserServiceRole && browserServiceRole.trim()) {
    throw new Error('Service role key must never be used in the browser runtime.');
  }
}

export function getSupabaseBrowserClient(): SupabaseBrowserClient | null {
  assertNoServiceRoleKeyInBrowser();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient(url, publishableKey, {
      global: {
        fetch,
      },
    });
  }

  return browserClient;
}

export function isSupabaseBrowserReady(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
