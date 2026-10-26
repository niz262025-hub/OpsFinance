'use client';

import { useEffect, useState } from 'react';

/**
 * MYOPS places its single-use ticket in the URL fragment, never the query string.
 * The fragment is cleared before any network request, rendering or logging.
 */
export default function LaunchPage() {
  const [message, setMessage] = useState('Verifying access with MYOPS…');

  useEffect(() => {
    let cancelled = false;
    const fragment = window.location.hash.slice(1);
    window.history.replaceState(null, '', '/launch');
    const ticket = new URLSearchParams(fragment).get('t');
    if (!ticket || !/^[A-Za-z0-9_-]{43}$/.test(ticket)) {
      setMessage('Invalid or expired launch link. Please reopen OpsFinance from MYOPS.');
      return;
    }
    void (async () => {
      try {
        const response = await fetch('/api/myops/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket }),
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!response.ok) throw new Error('access_unavailable');
        if (!cancelled) window.location.replace('/dashboard');
      } catch {
        if (!cancelled) setMessage('Single sign-on is not yet available for this account. Please return to MYOPS.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <main style={{ maxWidth: 560, padding: 32, margin: '12vh auto', textAlign: 'center' }}>
      <h1>Connecting OpsFinance</h1>
      <p role="status">{message}</p>
      <a href={process.env.NEXT_PUBLIC_MYOPS_LOGIN_URL || 'https://myops.com.my'}>Return to MYOPS</a>
    </main>
  );
}
