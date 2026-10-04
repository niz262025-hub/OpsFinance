import { createBrowserClient } from '@supabase/ssr';

export type SupabaseBrowserClient = ReturnType<typeof createBrowserClient>;

let browserClient: SupabaseBrowserClient | null = null;

export function getSupabaseBrowserClient(): SupabaseBrowserClient | null {
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
