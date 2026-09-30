'use client';

import { useRouter } from 'next/navigation';

import { getSupabaseBrowserClient } from '../lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push('/login');
  };

  return (
    <button type="button" onClick={handleLogout} style={{ marginTop: '0.75rem' }}>
      Sign out
    </button>
  );
}
