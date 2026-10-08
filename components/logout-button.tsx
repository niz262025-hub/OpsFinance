'use client';

import { useRouter } from 'next/navigation';

import { clearSupabaseSessionStorage, navigateToLogin } from '../lib/auth/navigation';
import { getSupabaseBrowserClient } from '../lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();

    clearSupabaseSessionStorage();
    navigateToLogin((url) => {
      if (typeof window !== 'undefined') {
        window.location.replace(url);
        return;
      }

      router.replace(url);
    });

    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Sign-out is best-effort; the browser is already navigated back to the login page.
      }
    }
  };

  return (
    <button type="button" onClick={handleLogout} style={{ marginTop: '0.75rem' }}>
      Sign out
    </button>
  );
}
