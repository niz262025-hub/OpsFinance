'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';

type FinancialAccountsWorkflowProps = {
  businessId?: string;
  businessContextError?: string | null;
};

type FinancialAccountRecord = {
  id: string;
  name: string;
  type: string;
  account_code?: string;
  accountCode?: string;
  currency?: string;
  status?: string;
  opening_balance?: string;
  opening_balance_date?: string | null;
  openingBalance?: string;
  account_id?: string | null;
  accountId?: string | null;
  bank_name?: string | null;
  company_name?: string | null;
  account_number?: string | null;
};

const formatMoney = (value: string | number | undefined) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return 'RM0.00';
  }
  return `RM${numeric.toFixed(2)}`;
};

export function FinancialAccountsWorkflow({ businessId, businessContextError }: FinancialAccountsWorkflowProps) {
  const [accounts, setAccounts] = useState<FinancialAccountRecord[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<Array<{id: string; code: string; name: string; is_active: boolean}>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const formRef = useCallback((node: HTMLElement | null) => {
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);
  const [form, setForm] = useState({
    bankName: '', companyName: '', accountNumber: '',
    name: '',
    type: 'BANK',
    accountCode: '',
    currency: 'MYR',
    accountId: '',
    openingBalance: '0.00',
    openingBalanceDate: '2026-09-01',
    status: 'ACTIVE',
  });

  const loadAccounts = useCallback(async () => {
    if (!businessId) {
      setAccounts([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [response, ledgerResponse] = await Promise.all([
        fetch(`/api/financial-accounts?businessId=${encodeURIComponent(businessId)}`),
        fetch(`/api/accounts?businessId=${encodeURIComponent(businessId)}`),
      ]);
      const [payload, ledgerPayload] = await Promise.all([response.json(), ledgerResponse.json()]);
      if (!ledgerResponse.ok) throw new Error(ledgerPayload.error ?? 'Could not load ledger accounts.');
      setLedgerAccounts((ledgerPayload.accounts ?? []).filter((account: {is_active: boolean}) => account.is_active));

      if (!response.ok) {
        throw new Error(payload.error ?? 'Could not load financial accounts.');
      }

      setAccounts(payload.financialAccounts ?? []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not load financial accounts.');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const resetForm = () => {
    setForm({
      bankName: '', companyName: '', accountNumber: '',
    name: '',
      type: 'BANK',
      accountCode: '',
      currency: 'MYR',
      accountId: '',
      openingBalance: '0.00',
      openingBalanceDate: '2026-09-01',
      status: 'ACTIVE',
    });
    setIsEditing(false);
    setSelectedId(null);
    setError(null);
  };

  const handleCreate = async () => {
    if (!businessId) {
      setError('No active business is available for this user.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (form.type === 'BANK' && (!form.bankName.trim() || !form.companyName.trim() || !form.accountNumber.trim())) throw new Error('Bank name, company/account holder name and account number are required.');
      if (!form.accountId) throw new Error('Select a ledger account before creating a financial account.');
      if (!form.name.trim()) {
        throw new Error('Account name is required.');
      }
      if (!form.accountCode.trim()) {
        throw new Error('Account code is required.');
      }

      const response = await fetch('/api/financial-accounts', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          id: isEditing ? selectedId : undefined,
          bankName: form.bankName, companyName: form.companyName, accountNumber: form.accountNumber,
          name: form.name,
          type: form.type,
          accountCode: form.accountCode,
          currency: form.currency,
          accountId: form.accountId || null,
          openingBalance: form.openingBalance,
          openingBalanceDate: form.openingBalanceDate,
          status: form.status,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to create financial account.');
      }

      await loadAccounts();
      resetForm();
      setSelectedId(payload.financialAccount?.id ?? null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to create financial account.');
    } finally {
      setLoading(false);
    }
  };

  if (!businessId) {
    return (
      <main className="opsfinance-workflow-panel" style={{ padding: '1.5rem 1rem 2.5rem' }}>
        <div className="opsfinance-surface" style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem' }}>
          <h1 style={{ marginTop: 0 }}>Financial Accounts</h1>
          <p style={{ margin: 0, color: '#475569' }}>{businessContextError ?? 'No active business is available for this user.'}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="opsfinance-workflow-panel" style={{ padding: '1.5rem 1rem 2.5rem' }}>
      <div className="opsfinance-workflow-inner" style={{ maxWidth: 1280 }}>
        <header className="opsfinance-workflow-header">
          <div>
            <p className="opsfinance-kicker">OpsFinance</p>
            <h1 style={{ margin: '0.35rem 0 0', fontSize: 'clamp(2rem, 4vw, 2.6rem)' }}>Financial Accounts</h1>
          </div>
          <div className="opsfinance-action-row">
            <Link href="/accounts/chart" className="opsfinance-secondary-button">Accounts</Link>
            <button type="button" className="opsfinance-primary-button" onClick={() => resetForm()}>New account</button>
          </div>
        </header>

        {businessContextError ? <div role="alert" className="opsfinance-surface" style={{ background: '#fff1f2', border: '1px solid #fecdd3', padding: '1rem' }}>{businessContextError}</div> : null}

        <section ref={formRef} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '1rem', display: 'grid', gap: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>{isEditing ? 'Edit account' : 'Create new account'}</h2>
            <button type="button" onClick={() => resetForm()} style={{ background: '#e2e8f0', color: '#0f172a', border: 'none', borderRadius: 10, padding: '0.6rem 0.9rem', fontWeight: 700, cursor: 'pointer' }}>Clear</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
            <label style={{ display: 'grid', gap: '0.25rem' }}>Name<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>Type<select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}><option value="BANK">Bank</option><option value="CASH">Cash</option><option value="E_WALLET">E-Wallet</option><option value="CREDIT_CARD">Credit Card</option><option value="LOAN">Loan</option><option value="OTHER">Other</option></select></label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>Code<input value={form.accountCode} onChange={(event) => setForm((current) => ({ ...current, accountCode: event.target.value }))} /></label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>Currency<input value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} /></label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <label>Bank name<input value={form.bankName} onChange={(event) => setForm(current => ({...current,bankName:event.target.value}))} /></label>
            <label>Company / account holder name<input value={form.companyName} onChange={(event) => setForm(current => ({...current,companyName:event.target.value}))} /></label>
            <label>Account number<input type="text" inputMode="numeric" autoComplete="off" value={form.accountNumber} onChange={(event) => setForm(current => ({...current,accountNumber:event.target.value}))} /></label>
          </div>
          <p>Use the full account number, including leading zeros. Statement imports require an exact account-number match.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <label style={{ display: 'grid', gap: '0.25rem' }}>COA mapping<select value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}><option value="">Select a ledger account</option>{ledgerAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>Opening balance<input disabled={isEditing} value={form.openingBalance} onChange={(event) => setForm((current) => ({ ...current, openingBalance: event.target.value }))} /></label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>Opening date<input disabled={isEditing} type="date" value={form.openingBalanceDate} onChange={(event) => setForm((current) => ({ ...current, openingBalanceDate: event.target.value }))} /></label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>Status<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></label>
          </div>
          <button type="button" disabled={loading} onClick={() => void handleCreate()} style={{ width: 'fit-content', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10, padding: '0.7rem 1rem', fontWeight: 700, cursor: 'pointer' }}>{isEditing ? 'Save account' : '+ Create Account'}</button>
        </section>

        {error ? <div role="alert" style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 18, padding: '1rem' }}>{error}</div> : null}

        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '1rem' }}>
          {loading ? <div>Loading financial accounts…</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr><th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>Name</th><th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>Type</th><th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>Code</th><th style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>Opening balance</th><th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>Status</th><th>Bank details</th><th>Action</th></tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>{account.name}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>{account.type}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>{account.account_code ?? account.accountCode ?? '-'}</td>
                    <td style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>{formatMoney(account.opening_balance ?? account.openingBalance ?? '0.00')}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>{account.status ?? 'ACTIVE'}</td>
                    <td>{account.bank_name ?? '-'} · {account.company_name ?? '-'} · {account.account_number ? `••••${account.account_number.slice(-4)}` : 'Account number not set'}</td>
                    <td><button type="button" disabled={loading} onClick={() => {
                      setSelectedId(account.id); setIsEditing(true); setError(null);
                      setForm({name:account.name,type:account.type,accountCode:account.account_code ?? account.accountCode ?? '',currency:account.currency ?? 'MYR',accountId:account.account_id ?? account.accountId ?? '',openingBalance:String(account.opening_balance ?? account.openingBalance ?? '0'),openingBalanceDate:account.opening_balance_date ?? '',status:account.status ?? 'ACTIVE',bankName:account.bank_name ?? '',companyName:account.company_name ?? '',accountNumber:account.account_number ?? ''});
                    }}>Edit {account.name}</button></td>
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
