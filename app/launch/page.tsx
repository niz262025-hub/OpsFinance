'use client';

import { useEffect, useState } from 'react';

export default function LaunchPage() {
  const [status, setStatus] = useState('Checking application launch...');

  useEffect(() => {
    const fragment = window.location.hash;
    window.history.replaceState(null, '', '/launch');
    const valid = /^#t=[A-Za-z0-9_-]{43}$/.test(fragment);
    setStatus(valid
      ? 'Secure launch is not yet available. Please return to MYOPS.'
      : 'Launch request is invalid. Please return to MYOPS.');
  }, []);

  return (
    <main style={{ maxWidth: 560, margin: '5rem auto', padding: 24 }}>
      <h1>OpsFinance secure launch</h1>
      <p role="status">{status}</p>
      <a href="https://myops.com.my/">Return to MYOPS</a>
    </main>
  );
}
