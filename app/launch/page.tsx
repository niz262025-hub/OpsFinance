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
    // The fragment is deliberately not posted until the backend can both
    // redeem it and create a real, authorized Supabase user session.
    setStatus('MYOPS single sign-on is being configured. No ticket was consumed. Please return to MYOPS.');
  }, []);

  return (
    <main style={{ maxWidth: 560, margin: '5rem auto', padding: 24 }}>
      <h1>OpsFinance secure launch</h1>
      <p role="status">{status}</p>
      <a href="https://myops.com.my/">Return to MYOPS</a>
    </main>
  );
}
