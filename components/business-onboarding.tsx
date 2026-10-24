'use client';

import { useRouter } from 'next/navigation';
import React, { FormEvent, useState } from 'react';

import { getSupabaseBrowserClient } from '../lib/supabase/client';

export function BusinessOnboarding() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [registrationNo, setRegistrationNo] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const createBusiness = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError('Enter your business name to continue.');
      return;
    }

    const client = getSupabaseBrowserClient();
    if (!client) {
      setError('OpsFinance is not connected to its database. Please try again later.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { error: createError } = await client.rpc('create_business_with_owner', {
        p_name: normalizedName,
        p_registration_no: registrationNo.trim() || null,
        p_address: null,
        p_phone: phone.trim() || null,
        p_email: email.trim() || null,
        p_base_currency: 'MYR',
        p_fiscal_year_start: null,
      });

      if (createError) throw createError;
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Business setup failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={createBusiness} aria-label="Business setup" style={{ display: 'grid', gap: '0.9rem', maxWidth: 640, marginTop: '1.25rem' }}>
      <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 600 }}>
        Business name <span aria-hidden="true" style={{ color: '#b91c1c' }}>*</span>
        <input required maxLength={160} autoComplete="organization" value={name} onChange={(event) => setName(event.target.value)} placeholder="For example, Southern Dotcom Sdn. Bhd." style={inputStyle} />
      </label>
      <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 600 }}>
        Registration number <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
        <input maxLength={80} value={registrationNo} onChange={(event) => setRegistrationNo(event.target.value)} style={inputStyle} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem' }}>
        <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 600 }}>
          Business email <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
          <input type="email" maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 600 }}>
          Phone <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
          <input type="tel" maxLength={40} autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} style={inputStyle} />
        </label>
      </div>
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>Currency: Malaysian Ringgit (MYR). You can update your business profile later.</p>
      {error ? <p role="alert" style={{ margin: 0, color: '#b91c1c' }}>{error}</p> : null}
      <div>
        <button type="submit" disabled={saving} style={{ border: 0, borderRadius: 10, padding: '0.8rem 1rem', background: '#123b72', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
          {saving ? 'Setting up…' : 'Create business workspace'}
        </button>
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 42,
  padding: '0.65rem 0.75rem',
  border: '1px solid #cbd5e1',
  borderRadius: 9,
  font: 'inherit',
};
