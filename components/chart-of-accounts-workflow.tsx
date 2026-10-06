'use client';

import React, { useCallback, useEffect, useState } from 'react';

type ChartOfAccountsWorkflowProps = { businessId?: string };

export function ChartOfAccountsWorkflow({ businessId }: ChartOfAccountsWorkflowProps) {
  const [accounts, setAccounts] = useState<Array<any>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    account_type: 'ASSET',
    normal_balance: 'DEBIT',
    parent_id: '',
    is_active: true,
  });

  const loadAccounts = useCallback(async () => {
    if (!businessId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/accounts?businessId=${encodeURIComponent(businessId)}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'Could not load chart of accounts.');
      }

      setAccounts(payload.accounts ?? []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not load chart of accounts.');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleCreate = async () => {
    if (!businessId) return;

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          code: form.code,
          name: form.name,
          account_type: form.account_type,
          normal_balance: form.normal_balance,
          parent_id: form.parent_id || null,
          is_active: form.is_active,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'Could not create account.');
      }

      setForm({ code: '', name: '', account_type: 'ASSET', normal_balance: 'DEBIT', parent_id: '', is_active: true });
      await loadAccounts();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not create account.');
    }
  };

  if (!businessId) {
    return <main style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}><div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '1.5rem' }}>No active business available for chart of accounts.</div></main>;
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: '1.5rem 1rem 2rem', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gap: '1rem' }}>
        <h1>Chart of Accounts</h1>

        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '1rem', display: 'grid', gap: '0.8rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
            <label style={{ display: 'grid', gap: '0.25rem' }}>Code<input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>Name<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>Type<select value={form.account_type} onChange={(event) => setForm((current) => ({ ...current, account_type: event.target.value }))}><option value="ASSET">ASSET</option><option value="LIABILITY">LIABILITY</option><option value="EQUITY">EQUITY</option><option value="REVENUE">REVENUE</option><option value="COGS">COGS</option><option value="EXPENSE">EXPENSE</option></select></label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>Normal Balance<select value={form.normal_balance} onChange={(event) => setForm((current) => ({ ...current, normal_balance: event.target.value }))}><option value="DEBIT">DEBIT</option><option value="CREDIT">CREDIT</option></select></label>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="button" onClick={handleCreate} style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10, padding: '0.7rem 1rem', fontWeight: 700, cursor: 'pointer' }}>Create account</button>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} /> Active</label>
          </div>
        </section>

        {error ? <div role="alert" style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 18, padding: '1rem' }}>{error}</div> : null}

        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '1rem' }}>
          {loading ? <div>Loading chart data…</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: '0.5rem' }}>Code</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: '0.5rem' }}>Name</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: '0.5rem' }}>Type</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: '0.5rem' }}>Normal</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: '0.5rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>{account.code}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>{account.name}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>{account.account_type}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>{account.normal_balance}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>{account.is_active ? 'ACTIVE' : 'INACTIVE'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
