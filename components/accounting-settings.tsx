'use client';

import { useEffect, useState } from 'react';

import { getSupabaseBrowserClient } from '../lib/supabase/client';

type AccountingSettingsPageProps = {
  businessId?: string | null;
  businessContextError?: string | null;
};

export function AccountingSettingsPage({ businessId, businessContextError }: AccountingSettingsPageProps) {
  const [form, setForm] = useState({
    baseCurrency: 'MYR',
    fiscalYearStart: '',
  });
  const [updatedAt, setUpdatedAt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!businessId) {
        setError('No active business is available for this user.');
        return;
      }

      setIsLoading(true);
      setError(null);
      setSuccess(null);

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setError('Supabase is not configured in this environment.');
        setIsLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .maybeSingle();

      if (fetchError) {
        setError(fetchError.message ?? 'Unable to load the business profile.');
        setIsLoading(false);
        return;
      }

      if (!data) {
        setError('No business record is available for this user.');
        setIsLoading(false);
        return;
      }

      setForm({
        baseCurrency: data.base_currency ?? 'MYR',
        fiscalYearStart: data.fiscal_year_start ?? '',
      });
      setUpdatedAt(data.updated_at ?? '');
      setIsLoading(false);
    };

    void loadProfile();
  }, [businessId]);

  const handleSave = async () => {
    if (!businessId) {
      setError('No active business is available for this user.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase is not configured in this environment.');
      setIsSaving(false);
      return;
    }

    const payload = {
      base_currency: form.baseCurrency || 'MYR',
      fiscal_year_start: form.fiscalYearStart || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error: saveError } = await supabase
      .from('businesses')
      .update(payload)
      .eq('id', businessId)
      .select()
      .maybeSingle();

    setIsSaving(false);

    if (saveError) {
      setError(saveError.message ?? 'Unable to save accounting settings.');
      return;
    }

    if (!data) {
      setError('The accounting settings could not be updated.');
      return;
    }

    setForm({
      baseCurrency: data.base_currency ?? 'MYR',
      fiscalYearStart: data.fiscal_year_start ?? '',
    });
    setUpdatedAt(data.updated_at ?? '');
    setSuccess('Accounting settings saved successfully.');
  };

  if (!businessId) {
    return (
      <main style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'Arial, sans-serif', padding: '1.5rem 1rem 2.5rem' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '1.25rem' }}>
          <h1>Accounting settings</h1>
          <p style={{ margin: 0, color: '#475569' }}>{businessContextError ?? 'No active business is available for this user.'}</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'Arial, sans-serif', padding: '1.5rem 1rem 2.5rem' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: '1.25rem' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: 0, color: '#475569', letterSpacing: '0.08em', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Settings</p>
            <h1 style={{ margin: '0.35rem 0 0', fontSize: 'clamp(2rem, 4vw, 2.5rem)' }}>Accounting Settings</h1>
          </div>
        </header>

        {businessContextError ? (
          <div role="alert" style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#9f1239', borderRadius: 10, padding: '0.75rem' }}>{businessContextError}</div>
        ) : null}

        {isLoading ? (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '1.25rem', color: '#475569' }}>Loading accounting settings…</div>
        ) : (
          <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '1.25rem', display: 'grid', gap: '1rem' }}>
            {error ? <div role="alert" style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#9f1239', borderRadius: 10, padding: '0.75rem' }}>{error}</div> : null}
            {success ? <div role="status" style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 10, padding: '0.75rem' }}>{success}</div> : null}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>Base currency</span>
                <input value={form.baseCurrency} onChange={(event) => setForm((current) => ({ ...current, baseCurrency: event.target.value.toUpperCase() }))} style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '0.7rem 0.8rem' }} />
              </label>

              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>Fiscal year start</span>
                <input type="date" value={form.fiscalYearStart} onChange={(event) => setForm((current) => ({ ...current, fiscalYearStart: event.target.value }))} style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '0.7rem 0.8rem' }} />
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ color: '#475569', fontSize: 13 }}>Last updated: {updatedAt || '—'}</div>
              <button type="button" onClick={() => void handleSave()} disabled={isSaving} style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10, padding: '0.8rem 1.2rem', fontWeight: 700, cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}>
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
