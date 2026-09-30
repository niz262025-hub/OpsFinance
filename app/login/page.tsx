'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { normalizeAuthError } from '../../lib/auth/session';
import { getSupabaseBrowserClient } from '../../lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase is not configured in this environment.');
      return;
    }

    setPending(true);
    setError('');
    setStatus('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    setPending(false);

    if (authError) {
      setError(normalizeAuthError(authError));
      return;
    }

    if (data.session) {
      setStatus('Signed in successfully.');
      router.push('/dashboard');
      return;
    }

    setError('No active session was returned. Please try again.');
  };

  return (
    <main style={{ maxWidth: 420, margin: '4rem auto', padding: '2rem', background: '#fff', borderRadius: 12 }}>
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <label>
            Email
            <input type="email" name="email" style={{ width: '100%', marginTop: 4 }} />
          </label>
          <label>
            Password
            <input type="password" name="password" style={{ width: '100%', marginTop: 4 }} />
          </label>
          <button type="submit" disabled={pending}>{pending ? 'Signing in...' : 'Sign in'}</button>
        </div>
      </form>
      {status ? <p>{status}</p> : null}
      {error ? <p style={{ color: '#b42318' }}>{error}</p> : null}
    </main>
  );
}
