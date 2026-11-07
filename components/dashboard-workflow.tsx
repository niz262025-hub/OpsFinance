'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

import { getSupabaseBrowserClient } from '../lib/supabase/client';
import { AccountingEngine, type BusinessAccount } from '../packages/accounting';
import { FinancialReportService } from '../packages/reports';
import { BusinessOnboarding } from './business-onboarding';

type DashboardWorkflowProps = {
  businessId?: string;
  businessName?: string;
};

const formatMoney = (value: string | number | undefined) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return 'RM0.00';
  }
  return `RM${numeric.toFixed(2)}`;
};

const quickActions = [
  { href: '/transactions/money-in', label: 'Money In' },
  { href: '/transactions/money-out', label: 'Money Out' },
  { href: '/transactions/transfer', label: 'Transfer' },
  { href: '/transactions/journal', label: 'Journal Entry' },
  { href: '/accounts/financial', label: 'Bank Accounts' },
  { href: '/upload', label: 'Upload & Convert' },
];

function DashboardWelcome({ businessName }: { businessName?: string }) {
  const [clock, setClock] = useState<Date | null>(null);
  useEffect(() => {
    const update = () => setClock(new Date());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const hour = clock?.getHours() ?? 0;
  const greeting = clock ? (hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Night') : 'Welcome';
  return <header className="opsfinance-dashboard-header">
    <div><p className="opsfinance-section-kicker">MYOPS</p><h1>{greeting}{businessName ? `, ${businessName}` : ''}</h1></div>
    <time className="opsfinance-dashboard-clock" dateTime={clock?.toISOString()}>
      {clock?.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
      <strong>{clock?.toLocaleTimeString('en-MY')}</strong>
    </time>
  </header>;
}

export function DashboardWorkflow({ businessId, businessName }: DashboardWorkflowProps) {
  const [summary, setSummary] = useState<Array<{ label: string; value: string }>>([]);
  const [balances, setBalances] = useState<Array<{ id: string; name: string; type: string; balance: string }>>([]);
  const [recentTransactions, setRecentTransactions] = useState<Array<{ id: string; description: string; status: string; referenceNo?: string; amount: string; date: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!businessId) {
        setSummary([]);
        setBalances([]);
        setRecentTransactions([]);
        return;
      }

      const client = getSupabaseBrowserClient();
      if (!client) {
        setError('Supabase is not configured in this environment.');
        return;
      }

      setLoading(true);
      try {
        const [accountsResult, journalRows] = await Promise.all([
          client.from('accounts').select('*').eq('business_id', businessId).order('code', { ascending: true }),
          (async () => {
            const rows: any[] = [];
            const pageSize = 500;
            for (let offset = 0; ; offset += pageSize) {
              const page = await client.from('journal_entries')
                .select('id, business_id, journal_no, journal_date, description, status, source_type, created_at, journal_lines(*)')
                .eq('business_id', businessId).eq('status', 'POSTED')
                .order('journal_date', { ascending: false })
                .order('created_at', { ascending: false }).order('id', { ascending: false })
                .range(offset, offset + pageSize - 1);
              if (page.error) throw new Error(page.error.message);
              rows.push(...(page.data ?? []));
              if ((page.data ?? []).length < pageSize) return rows;
            }
          })(),
        ]);

        if (accountsResult.error) throw new Error(accountsResult.error.message);

        const accounts = (accountsResult.data ?? []).map((row: any) => ({
          id: row.id,
          businessId: row.business_id,
          code: row.code,
          name: row.name,
          accountType: row.account_type,
          normalBalance: row.normal_balance,
          isSystem: row.is_system,
          isActive: row.is_active,
          parentId: row.parent_id,
        })) as BusinessAccount[];

        const engine = new AccountingEngine({ businessId, accounts });
        const service = new FinancialReportService({
          engine,
          repository: {
            getBusinessAccounts: () => accounts,
            getPostedJournals: () =>
              journalRows.map((row: any) => ({
                id: row.id,
                businessId: row.business_id,
                journalNo: row.journal_no,
                journalDate: row.journal_date,
                sourceType: row.source_type ?? 'MANUAL',
                description: row.description,
                status: row.status,
                referenceNo: row.journal_no,
                lines: (row.journal_lines ?? []).map((line: any) => ({
                  id: line.id,
                  journalEntryId: line.journal_entry_id,
                  accountId: line.account_id,
                  debit: String(line.debit ?? '0.00'),
                  credit: String(line.credit ?? '0.00'),
                  description: line.description,
                  financialAccountId: line.financial_account_id,
                  contactId: line.contact_id,
                })),
                createdAt: row.created_at ?? new Date().toISOString(),
              })),
          },
        });

        const pnl = service.getProfitAndLoss({ businessId });
        const cashFlow = service.getCashFlow({ businessId });
        const balancesData = accounts
          .map((account) => {
            const statement = service.getAccountStatement({ businessId, accountId: account.id });
            return {
              id: account.id,
              name: account.name,
              type: account.accountType,
              balance: statement.closingBalance,
            };
          })
          .filter((account) => Number(account.balance) !== 0 || account.type === 'ASSET' || account.type === 'LIABILITY' || account.type === 'EQUITY');

        setSummary([
          { label: 'Total Cash', value: cashFlow.closingCash },
          { label: 'Sales / Revenue', value: pnl.revenueTotal },
          { label: 'Expenses', value: pnl.expensesTotal },
          { label: 'Net Profit', value: pnl.netProfit },
        ]);
        setBalances(balancesData);
        setRecentTransactions(
          journalRows.slice(0, 6).map((row: any) => ({
            id: row.id,
            description: row.description ?? row.journal_no,
            status: row.status,
            referenceNo: row.journal_no,
            amount: (row.journal_lines ?? []).reduce((sum: number, line: any) => sum + Number(line.debit ?? 0), 0).toFixed(2),
            date: row.journal_date,
          })),
        );
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Dashboard data could not be loaded.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [businessId]);

  if (!businessId) {
    return (
      <main className="opsfinance-dashboard">
        <div className="opsfinance-panel" style={{ maxWidth: 960, margin: '0 auto' }}>
          <header className="opsfinance-dashboard-header">
            <div>
              <p className="opsfinance-section-kicker">OpsFinance</p>
              <h1>OpsFinance Dashboard</h1>
            </div>
          </header>
          <p style={{ margin: '0.5rem 0 1rem', color: 'var(--muted)' }}>Set up your business to start using OpsFinance. Your records will be kept in a separate business workspace.</p>
          <BusinessOnboarding />
          <div className="opsfinance-kpi-grid" style={{ marginTop: '1rem' }}>
            {['Total Cash', 'Sales / Revenue', 'Expenses', 'Net Profit'].map((label) => (
              <div key={label} className="opsfinance-stat-card">
                <div className="label">{label}</div>
                <div className="value">{formatMoney('0')}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1rem' }}>
            <h2 className="opsfinance-panel-header">Financial Account Balances</h2>
            <p style={{ margin: 0, color: 'var(--muted)' }}>No account balances available.</p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="opsfinance-dashboard">
        <div role="alert" className="opsfinance-panel" style={{ maxWidth: 960, margin: '0 auto', background: '#fff1f2', borderColor: '#fecdd3' }}>
          <h1 style={{ marginTop: 0 }}>Dashboard error</h1>
          <p style={{ marginBottom: 0 }}>{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="opsfinance-dashboard">
      <DashboardWelcome businessName={businessName} />

      {loading ? <div className="opsfinance-panel" role="status">Loading your financial summary…</div> : null}

      <section className="opsfinance-panel" aria-labelledby="dashboard-quick-actions">
        <h2 id="dashboard-quick-actions" className="opsfinance-panel-header">Quick Actions</h2>
        <nav aria-label="Quick Actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          {quickActions.map(action => (
            <Link key={action.href} href={action.href} prefetch={false}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, maxWidth: '100%', padding: '0.65rem 1rem', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--brand-rose)', color: 'var(--text)', fontWeight: 700, overflowWrap: 'anywhere', textAlign: 'center' }}>
              {action.label}
            </Link>
          ))}
        </nav>
      </section>

      <section className="opsfinance-kpi-grid">
        {summary.map((card) => (
          <div key={card.label} className="opsfinance-stat-card">
            <div className="label">{card.label}</div>
            <div className="value">{formatMoney(card.value)}</div>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1rem' }}>
        <div className="opsfinance-panel">
          <h2 className="opsfinance-panel-header">Financial Account Balances</h2>
          {balances.length === 0 ? <div style={{ color: 'var(--muted)' }}>No account balances available.</div> : (
            <div className="opsfinance-balance-list">
              {balances.map((account) => (
                <div key={account.id} className="opsfinance-balance-item">
                  <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                    <strong>{account.name}</strong>
                    <span>{account.type}</span>
                  </div>
                  <div style={{ minWidth: 0, overflowWrap: 'anywhere', fontWeight: 700, color: 'var(--text)' }}>{formatMoney(account.balance)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="opsfinance-panel">
          <h2 className="opsfinance-panel-header">Recent Posted Transactions</h2>
          {recentTransactions.length === 0 ? <div style={{ color: 'var(--muted)' }}>No posted activity yet.</div> : (
            <div className="opsfinance-transaction-list">
              {recentTransactions.map((transaction) => (
                <div key={transaction.id} className="opsfinance-txn-item">
                  <div className="opsfinance-txn-item-top" style={{ flexWrap: 'wrap' }}>
                    <strong style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{transaction.description}</strong>
                    <span className="opsfinance-status">{transaction.status}</span>
                  </div>
                  <div className="meta" style={{ overflowWrap: 'anywhere' }}>{transaction.referenceNo ?? transaction.date}</div>
                  <div style={{ overflowWrap: 'anywhere', fontWeight: 700, marginTop: '0.2rem', color: 'var(--text)' }}>{formatMoney(transaction.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
