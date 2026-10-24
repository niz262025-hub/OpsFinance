'use client';

import { useEffect, useState } from 'react';
import { isLaunchTicketFragment } from '../../lib/auth/launch-ticket';

export default function LaunchPage() {
  const [status, setStatus] = useState('Checking application launch...');

  useEffect(() => {
    const fragment = window.location.hash;
    window.history.replaceState(null, '', '/launch');
    if (!isLaunchTicketFragment(fragment)) {
      setStatus('Launch request is invalid. Please return to MYOPS.');
      return;
    }
    const controller = new AbortController();
    setStatus('Verifying your MYOPS access...');
    fetch('/api/myops/redeem', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ticket: fragment.slice(3) }),
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error('SSO unavailable');
      const result: unknown = await response.json();
      if (!result || typeof result !== 'object' || (result as { redirectTo?: unknown }).redirectTo !== '/dashboard') {
        throw new Error('Invalid launch response');
      }
      window.location.replace('/dashboard');
    }).catch(() => {
      if (!controller.signal.aborted) setStatus('Secure sign-in is not available. Please return to MYOPS.');
    });
    return () => controller.abort();
  }, []);

  return (
    <main style={{ maxWidth: 560, margin: '5rem auto', padding: 24 }}>
      <h1>OpsFinance secure launch</h1>
      <p role="status">{status}</p>
      <a href="https://myops.com.my/">Return to MYOPS</a>
    </main>
  );
}
