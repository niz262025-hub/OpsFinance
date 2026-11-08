'use client';

import {useFinanceLocale} from './use-finance-locale';

import React, { useCallback, useEffect, useRef, useState } from 'react';

type TransactionWorkflowProps = { businessId?: string; defaultType?: 'MONEY_IN' | 'MONEY_OUT' | 'TRANSFER' | 'JOURNAL' };



type TransactionFormState = {
  type: 'MONEY_IN' | 'MONEY_OUT' | 'TRANSFER' | 'JOURNAL';
  date: string;
  description: string;
  amount: string;
  reference_no: string;
  financial_account_id: string;
  account_id: string;
};

export function TransactionWorkflow({ businessId, defaultType = 'MONEY_IN' }: TransactionWorkflowProps) {
  const {t:w,formatMoney}=useFinanceLocale();
  const [transactions, setTransactions] = useState<Array<any>>([]);
  const [accounts, setAccounts] = useState<Array<any>>([]);
  const [financialAccounts, setFinancialAccounts] = useState<Array<any>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const posting = useRef(false);
  const [form, setForm] = useState<TransactionFormState>({
    type: defaultType,
    date: '',
    description: '',
    amount: '',
    reference_no: '',
    financial_account_id: '',
    account_id: '',
  });

  useEffect(() => {
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setForm(current => ({ ...current, date: current.date || localDate }));
  }, []);

  const loadData = useCallback(async () => {
    if (!businessId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/transactions?businessId=${encodeURIComponent(businessId)}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'Could not load transaction data.');
      }

      setAccounts(payload.accounts ?? []);
      setFinancialAccounts(payload.financialAccounts ?? []);
      setTransactions(payload.transactions ?? []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not load transaction data.');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (posting.current || loading) return;
    setSuccess(false);
    if (!businessId || !form.financial_account_id || !form.account_id) {
      setError('Select a financial account and general ledger account before posting.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
      setError('Choose a transaction date before posting.');
      return;
    }
    if (!/^\d+(?:\.\d{1,2})?$/.test(form.amount.trim()) || !Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) {
      setError('Enter an amount greater than RM0 with no more than two decimal places.');
      return;
    }
    if (!form.description.trim()) {
      setError('Enter a description before posting.');
      return;
    }

    posting.current = true;
    setSaving(true);
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          type: form.type,
          date: form.date,
          description: form.description.trim(),
          amount: form.amount.trim(),
          reference_no: form.reference_no.trim(),
          financial_account_id: form.financial_account_id,
          account_id: form.account_id,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'Transaction could not be created.');
      }

      setError(null);
      setForm(current => ({ ...current, amount: '', description: '', reference_no: '' }));
      setSuccess(true);
      await loadData();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Transaction could not be created.');
    } finally {
      posting.current = false;
      setSaving(false);
    }
  };

  if (!businessId) {
    return <main className="opsfinance-workflow-panel" style={{ padding: '2rem' }}><div className="opsfinance-surface" style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem' }}>{w("No active business available for transaction posting.")}</div></main>;
  }

  return (
    <main className="opsfinance-workflow-panel" style={{ padding: '1.5rem 1rem 2rem' }}>
      <div className="opsfinance-workflow-inner" style={{ maxWidth: 1200 }}>
        <div className="opsfinance-workflow-header"><p className="opsfinance-kicker">OpsFinance</p><h1>{w("Transactions")}</h1></div>
        <div className="opsfinance-surface" style={{ padding: '0.75rem 1rem' }}>
          <strong>{w("All Transactions")}</strong>
        </div>

        <section className="opsfinance-surface" style={{ padding: '1rem', display: 'grid', gap: '0.8rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {[
              { value: 'MONEY_IN', label: w("Money In") },
              { value: 'MONEY_OUT', label: w("Money Out") },
              { value: 'TRANSFER', label: w("Transfer") },
              { value: 'JOURNAL', label: w("Journal Entry") },
            ].map((option) => {
              const isActive = form.type === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, type: option.value as TransactionFormState['type'] }))}
                  style={{
                    background: isActive ? '#0f172a' : '#f8fafc',
                    color: isActive ? '#fff' : '#0f172a',
                    border: '1px solid #cbd5e1',
                    borderRadius: 10,
                    padding: '0.6rem 0.9rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="opsfinance-form-grid">
            <label>{w("Type")}<select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as TransactionFormState['type'] }))}><option value="MONEY_IN">{w("Money In")}</option><option value="MONEY_OUT">{w("Money Out")}</option><option value="TRANSFER">{w("Transfer")}</option><option value="JOURNAL">{w("Journal")}</option></select></label>
            <label>{w("Date")}<input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} /></label>
            <label>{w("Amount")}<input inputMode="decimal" autoComplete="off" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} /></label>
          </div>
          <div className="opsfinance-form-grid">
            <label>{w("Financial account")}<select value={form.financial_account_id} onChange={(event) => setForm((current) => ({ ...current, financial_account_id: event.target.value }))}><option value="">{w("Select a financial account")}</option>{financialAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
            <label>{w("Ledger account")}<select value={form.account_id} onChange={(event) => setForm((current) => ({ ...current, account_id: event.target.value }))}><option value="">{w("Select a ledger account")}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          </div>
          <div className="opsfinance-form-grid">
            <label>{w("Description")}<input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
            <label>{w("Reference")}<input value={form.reference_no} onChange={(event) => setForm((current) => ({ ...current, reference_no: event.target.value }))} /></label>
          </div>
          <button type="button" className="opsfinance-primary-button" disabled={loading || saving} onClick={handleCreate}>{saving ? w("Posting…") : w("Create posting")}</button>
        </section>

        {error ? <div role="alert" className="opsfinance-surface" style={{ background: '#fff1f2', border: '1px solid #fecdd3', padding: '1rem' }}>{w(error)}</div> : null}
        {success ? <div role="status" className="opsfinance-surface" style={{ padding: '1rem' }}>{w("Transaction posted successfully.")}</div> : null}

        <section className="opsfinance-surface" style={{ padding: '1rem', overflowX: 'auto' }} aria-label={w("Recent transactions")}>
          {loading ? <div>{w("Loading transactions…")}</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr><th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>{w("Reference")}</th><th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>{w("Type")}</th><th style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>{w("Amount")}</th><th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>{w("Date")}</th></tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}><td style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>{transaction.reference_no ?? transaction.transaction_no}</td><td style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>{w(transaction.transaction_type)}</td><td style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>{formatMoney(transaction.amount)}</td><td style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>{transaction.transaction_date}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
