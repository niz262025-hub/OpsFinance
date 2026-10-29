'use client';

import React, { useEffect, useMemo, useState } from 'react';

type UploadWorkflowProps = {
  businessId?: string;
  businessContextError?: string | null;
};

type AccountOption = {
  id: string;
  code: string;
  name: string;
  account_type?: string;
  normal_balance?: string;
};

type FinancialAccountOption = {
  id: string;
  account_code: string;
  name: string;
  status: string;
  account_id?: string | null;
};

type UploadRow = {
  id: string;
  date: string;
  description: string;
  reference: string;
  amount: string;
  debit: string;
  credit: string;
  balance: string;
  direction: 'DEBIT' | 'CREDIT';
};

export function UploadWorkflow({ businessId, businessContextError }: UploadWorkflowProps) {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccountOption[]>([]);
  const [selectedFinancialAccountId, setSelectedFinancialAccountId] = useState('');
  const [statementId, setStatementId] = useState<string | null>(null);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [sourceText, setSourceText] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const activeBusinessId = businessId ?? '';
    if (!activeBusinessId) return;

    let cancelled = false;
    setSelectedFinancialAccountId('');
    setStatementId(null);
    setRows([]);
    setAccounts([]);
    setFinancialAccounts([]);
    async function loadAccounts() {
      const [ledgerResponse, financialResponse] = await Promise.all([
        fetch(`/api/accounts?businessId=${encodeURIComponent(activeBusinessId)}`),
        fetch(`/api/financial-accounts?businessId=${encodeURIComponent(activeBusinessId)}`),
      ]);
      if (!ledgerResponse.ok || !financialResponse.ok) throw new Error('Unable to load accounts. Reload and try again.');
      const [ledgerPayload, financialPayload] = await Promise.all([ledgerResponse.json(), financialResponse.json()]);
      if (cancelled) return;
      setAccounts(Array.isArray(ledgerPayload.accounts) ? ledgerPayload.accounts : []);
      setFinancialAccounts((Array.isArray(financialPayload.financialAccounts) ? financialPayload.financialAccounts : [])
        .filter((account: FinancialAccountOption) => account.status === 'ACTIVE' && account.account_id));
    }

    loadAccounts().catch((caughtError) => {
      if (!cancelled) setError(caughtError instanceof Error ? caughtError.message : 'Unable to load accounts.');
    });
    return () => { cancelled = true; };
  }, [businessId]);

  const previewSummary = useMemo(() => ({
    total: rows.length,
    totalAmount: rows.reduce((sum, row) => sum + Number(row.amount || '0.00'), 0).toFixed(2),
  }), [rows]);

  if (!businessId) {
    return (
      <main className="opsfinance-workflow-panel" style={{ padding: '2rem 1rem' }}>
        <div className="opsfinance-surface" style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem' }}>
          <h1 style={{ marginTop: 0 }}>Upload &amp; Convert</h1>
          <p style={{ marginBottom: 0 }}>{businessContextError ?? 'No active business is available for upload processing.'}</p>
        </div>
      </main>
    );
  }

  const handleFileSelection = async (file: File) => {
    if (!file) return;

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      if (!/\.(csv|txt)$/i.test(file.name)) throw new Error('CSV and TXT statements only. PDF, image and Excel extraction is not available yet.');
      if (file.size > 10 * 1024 * 1024) throw new Error('Statement exceeds the 10 MB limit.');
      if (!selectedFinancialAccountId) throw new Error('Select the bank or financial account for this statement first.');
      const content = await file.text();
      setSourceText(content);
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', businessId, financialAccountId: selectedFinancialAccountId, fileName: file.name, fileType: file.type || 'text/csv', content }),
      });

      const payload = await response.json();
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? 'Upload preview failed.');
      }

      setStatementId(payload.statementId ?? null);
      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setSuccess(`Preview loaded ${payload.rows?.length ?? 0} statement rows.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Preview failed.');
      setStatementId(null);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleParseReview = async () => {
    if (!selectedFinancialAccountId) {
      setError('Select the bank or financial account for this statement first.');
      return;
    }
    const payloadBody = sourceText.trim();
    if (!payloadBody) {
      setError('Upload a statement or paste a statement export before parsing.');
      setSuccess(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', businessId, financialAccountId: selectedFinancialAccountId, fileName: 'statement.csv', fileType: 'text/csv', content: payloadBody }),
      });

      const payload = await response.json();
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? 'Upload preview failed.');
      }

      setStatementId(payload.statementId ?? null);
      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setSuccess(`Preview loaded ${payload.rows?.length ?? 0} statement rows.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Preview failed.');
      setStatementId(null);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!statementId || !selectedAccountId) {
      setError('Select a posting account before approving the import.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          businessId,
          statementId,
          accountId: selectedAccountId,
          transactionType: 'JOURNAL',
        }),
      });

      const payload = await response.json();
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? 'Approval failed.');
      }

      setSuccess(`Approved and posted ${payload.summary?.postedCount ?? 0} rows.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Approval failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'Arial, sans-serif', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gap: '1rem' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '1.5rem' }}>
          <h1 style={{ marginTop: 0 }}>Upload &amp; Convert</h1>
          <p style={{ marginBottom: 0 }}>Import a CSV or TXT bank statement, review it, then approve posting. PDF, image and Excel extraction is not available yet.</p>
        </div>

        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '1rem', display: 'grid', gap: '0.8rem' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            Bank or financial account
            <select disabled={isLoading} value={selectedFinancialAccountId} onChange={(event) => {
              setSelectedFinancialAccountId(event.target.value);
              setStatementId(null);
              setRows([]);
              setSuccess(null);
              setError(null);
            }}>
              <option value="">Select the account this statement belongs to</option>
              {financialAccounts.map((account) => (
                <option key={account.id} value={account.id}>{account.account_code} - {account.name}</option>
              ))}
            </select>
          </label>
          <p style={{ margin: 0 }}>Only active financial accounts with a ledger mapping are available. Create or update them in Financial Accounts.</p>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            Upload a bank statement
            <input
              type="file"
              disabled={isLoading || !selectedFinancialAccountId}
              accept=".csv,.txt,text/csv,text/plain"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (file) {
                  await handleFileSelection(file);
                }
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.25rem' }}>
            Preview content
            <textarea
              disabled={isLoading}
              value={sourceText}
              onChange={(event) => { setSourceText(event.target.value); setStatementId(null); setRows([]); setSuccess(null); }}
              rows={12}
              style={{ resize: 'vertical', fontFamily: 'monospace' }}
              placeholder="Upload a CSV bank statement or paste a statement export to preview it here."
            />
          </label>

          <label style={{ display: 'grid', gap: '0.25rem' }}>
            Posting account
            <select disabled={isLoading} value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)}>
              <option value="">Select the accounting category</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <button type="button" onClick={handleParseReview} disabled={isLoading || !selectedFinancialAccountId || !sourceText.trim()} style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10, padding: '0.7rem 1rem', fontWeight: 700, cursor: 'pointer' }}>
              {isLoading ? 'Processing…' : 'Parse & review'}
            </button>
            <button type="button" onClick={handleApprove} disabled={isLoading || !statementId || !selectedAccountId} style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10, padding: '0.7rem 1rem', fontWeight: 700, cursor: 'pointer' }}>
              {isLoading ? 'Processing…' : 'Approve and post'}
            </button>
          </div>

          {error ? <div style={{ color: '#b91c1c', fontWeight: 600 }}>{error}</div> : null}
          {success ? <div style={{ color: '#166534', fontWeight: 600 }}>{success}</div> : null}

          {rows.length ? (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <strong>Imported rows</strong>
                <span>{previewSummary.total} rows · total {previewSummary.totalAmount}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                <thead>
                  <tr>
                    <th style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', padding: '0.5rem' }}>Date</th>
                    <th style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', padding: '0.5rem' }}>Description</th>
                    <th style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', padding: '0.5rem' }}>Reference</th>
                    <th style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', padding: '0.5rem' }}>Amount</th>
                    <th style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', padding: '0.5rem' }}>Direction</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.5rem' }}>{row.date}</td>
                      <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.5rem' }}>{row.description}</td>
                      <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.5rem' }}>{row.reference}</td>
                      <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.5rem' }}>{row.amount}</td>
                      <td style={{ borderBottom: '1px solid #f1f5f9', padding: '0.5rem' }}>{row.direction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
