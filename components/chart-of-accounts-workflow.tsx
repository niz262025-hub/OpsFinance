'use client';

import React, { useCallback, useEffect, useState } from 'react';

type ChartOfAccountsWorkflowProps = { businessId?: string };

export function ChartOfAccountsWorkflow({ businessId }: ChartOfAccountsWorkflowProps) {
  const [accounts, setAccounts] = useState<Array<any>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
    setError(null);
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
    if (!businessId || saving) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/accounts', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          id: editingId,
          code: form.code,
          name: form.name,
          account_type: form.account_type,
          normal_balance: form.normal_balance,
          parent_id: form.parent_id || null,
          is_active: form.is_active,
          is_system: false,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'Could not create account.');
      }

      setEditingId(null);
      setForm({ code: '', name: '', account_type: 'ASSET', normal_balance: 'DEBIT', parent_id: '', is_active: true });
      await loadAccounts();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not create account.');
    } finally {
      setSaving(false);
    }
  };

  if (!businessId) {
    return <main className="opsfinance-workflow-panel" style={{ padding: '2rem' }}><div className="opsfinance-surface" style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem' }}>No active business available for chart of accounts.</div></main>;
  }

  return (
    <main className="opsfinance-workflow-panel" style={{ padding: '1.5rem 1rem 2rem' }}>
      <div className="opsfinance-workflow-inner" style={{ maxWidth: 1200 }}>
        <div className="opsfinance-workflow-header"><p className="opsfinance-kicker">OpsFinance</p><h1>Chart of Accounts</h1></div>

        <section className="opsfinance-surface" style={{ padding: '1rem', display: 'grid', gap: '0.8rem' }}>
          <div className="opsfinance-form-grid">
            <label>Code<input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></label>
            <label>Name<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label>Type<select value={form.account_type} onChange={(event) => setForm((current) => ({ ...current, account_type: event.target.value, normal_balance: ['ASSET', 'COGS', 'EXPENSE'].includes(event.target.value) ? 'DEBIT' : 'CREDIT', parent_id: '' }))}><option value="ASSET">ASSET</option><option value="LIABILITY">LIABILITY</option><option value="EQUITY">EQUITY</option><option value="REVENUE">REVENUE</option><option value="COGS">COGS</option><option value="EXPENSE">EXPENSE</option></select></label>
            <label>Normal Balance<select value={form.normal_balance} onChange={(event) => setForm((current) => ({ ...current, normal_balance: event.target.value }))}><option value="DEBIT">DEBIT</option><option value="CREDIT">CREDIT</option></select></label>
            <label>Parent account<select value={form.parent_id} onChange={(event) => setForm((current) => ({ ...current, parent_id: event.target.value }))}><option value="">Top-level account</option>{accounts.filter((account) => account.account_type === form.account_type && account.id !== editingId).map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label>
          </div>
          <div className="opsfinance-action-row">
            <button type="button" className="opsfinance-primary-button" disabled={saving || loading} onClick={handleCreate}>{saving ? 'Saving…' : editingId ? 'Save account' : 'Create account'}</button>
            {editingId ? <button type="button" className="opsfinance-secondary-button" disabled={saving} onClick={() => { setEditingId(null); setForm({ code: '', name: '', account_type: 'ASSET', normal_balance: 'DEBIT', parent_id: '', is_active: true }); }}>Cancel</button> : null}
            <label className="opsfinance-inline-label"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} /> Active</label>
          </div>
        </section>

        {error ? <div role="alert" className="opsfinance-surface" style={{ background: '#fff1f2', border: '1px solid #fecdd3', padding: '1rem' }}>{error}</div> : null}

        <section className="opsfinance-surface" style={{ padding: '1rem' }}>
          {loading ? <div>Loading chart data…</div> : (
            <table className="opsfinance-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Parent</th>
                  <th>Normal</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td>{account.code}</td>
                    <td>{account.name}</td>
                    <td>{account.account_type}</td>
                    <td>{accounts.find((parent) => parent.id === account.parent_id)?.name ?? '—'}</td>
                    <td>{account.normal_balance}</td>
                    <td>{account.is_active ? 'ACTIVE' : 'INACTIVE'}</td>
                    <td>{account.is_system ? null : <button type="button" onClick={() => {
                      setEditingId(account.id);
                      setForm({
                        code: account.code,
                        name: account.name,
                        account_type: account.account_type,
                        normal_balance: account.normal_balance,
                        parent_id: account.parent_id ?? '',
                        is_active: account.is_active,
                      });
                      setError(null);
                    }}>Edit {account.name}</button>}</td>
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
