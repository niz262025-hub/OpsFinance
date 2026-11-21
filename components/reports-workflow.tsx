'use client';

import {useFinanceLocale} from './use-finance-locale';

import React, { useEffect, useMemo, useState } from 'react';
import {currentMonth,validReportPeriod} from '../lib/calendar';
import {loadReportRows} from '../lib/report-source';
import { reportCsv } from '../lib/report-csv';

import { isPreviewAuthBypassEnabled } from '../lib/auth/navigation';
import { PREVIEW_BUSINESS_ID, getPreviewFinancialSnapshot, getPreviewReportRepository } from '../lib/preview-data';
import { getSupabaseBrowserClient } from '../lib/supabase/client';
import { AccountingEngine, type BusinessAccount } from '../packages/accounting';
import { FinancialReportService } from '../packages/reports';

type ReportsWorkflowProps = { businessId?: string; businessContextError?: string | null; defaultReport?: 'ledger' | 'statement' | 'trial' | 'pnl' | 'sheet' | 'cash' };



type ReportTransaction = { date: string; journalNo: string; description: string; debit: string; credit: string; balance?: string; runningBalance?: string };
const reportCellStyle: React.CSSProperties = { padding: '0.6rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0' };
function ReportTransactions({ rows }: { rows: ReportTransaction[] }) {
  const {t:w,formatMoney}=useFinanceLocale();
  if (!rows.length) return <p>{w("No posted transactions in this period.")}</p>;
  return <div style={{ overflowX: 'auto' }}><table aria-label={w("Posted transactions")} style={{ width: '100%', borderCollapse: 'collapse' }}>
    <thead><tr>{[w("Date"), w("Journal"), w("Description"), w("Debit"), w("Credit"), w("Balance")].map(label => <th key={w(label)} scope="col" style={reportCellStyle}>{w(label)}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={`${row.journalNo}-${index}`}>
      <td style={reportCellStyle}>{row.date}</td><td style={reportCellStyle}>{row.journalNo}</td><td style={reportCellStyle}>{row.description}</td>
      <td style={reportCellStyle}>{formatMoney(row.debit)}</td><td style={reportCellStyle}>{formatMoney(row.credit)}</td><td style={reportCellStyle}>{formatMoney(row.balance ?? row.runningBalance)}</td>
    </tr>)}</tbody>
  </table></div>;
}

export function ReportsWorkflow({ businessId, businessContextError, defaultReport = 'trial' }: ReportsWorkflowProps) {
  const {t:w,formatMoney}=useFinanceLocale();
  const [report, setReport] = useState<'ledger' | 'statement' | 'trial' | 'pnl' | 'sheet' | 'cash'>(defaultReport);
  const [dateFrom, setDateFrom] = useState(()=>currentMonth().from);
  const [dateTo, setDateTo] = useState(()=>currentMonth().to);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [accounts, setAccounts] = useState<BusinessAccount[]>([]);
  const [reportSource, setReportSource] = useState<{ businessId: string; service: FinancialReportService } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshVersion,setRefreshVersion]=useState(0);

  useEffect(() => {
    let cancelled=false;
    setReportSource(null);setAccounts([]);setError(null);
    const load = async () => {
      if (!businessId) {
        setReportSource(null);
        setAccounts([]);

        return;
      }

      const isPreviewBusiness = isPreviewAuthBypassEnabled() || businessId === PREVIEW_BUSINESS_ID;

      if (isPreviewBusiness) {
        const snapshot = getPreviewFinancialSnapshot();
        const accountsList = snapshot.accounts as BusinessAccount[];
        const repository = getPreviewReportRepository();
        const service = new FinancialReportService({
          engine: new AccountingEngine({ businessId, accounts: accountsList }),
          repository,
        });

        setReportSource({ businessId, service });
        setAccounts(accountsList);
        setSelectedAccountId(current => accountsList.some(account => account.id === current) ? current : (accountsList[0]?.id ?? ''));
        setError(null);
        setLoading(false);
        return;
      }

      const client = getSupabaseBrowserClient();
      if (!client) {
        setError('Supabase is not configured in this environment.');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const {accounts:accountRows,journals:journalRows}=await loadReportRows(client,businessId);
        if(cancelled)return;

        const mappedAccounts = (accountRows ?? []).map((row: any) => ({
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

        const repository = {
          getBusinessAccounts: () => mappedAccounts,
          getPostedJournals: () =>
            (journalRows ?? []).map((row: any) => ({
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
        };

        const service = new FinancialReportService({
          engine: new AccountingEngine({ businessId, accounts: mappedAccounts }),
          repository,
        });

        setReportSource({ businessId, service });
        setAccounts(mappedAccounts);
        setSelectedAccountId(current => mappedAccounts.some(account => account.id === current) ? current : (mappedAccounts[0]?.id ?? ''));
      } catch (caughtError) {
        if(cancelled)return;
        setError(caughtError instanceof Error ? caughtError.message : 'Reports could not be loaded.');
      } finally {
        if(!cancelled)setLoading(false);
      }
    };

    void load();
    return ()=>{cancelled=true;};
  }, [businessId,refreshVersion]);
  const periodValid=validReportPeriod(dateFrom,dateTo);
  const service=reportSource&&reportSource.businessId===businessId?reportSource.service:null;
  const {trial,pnl,sheet,cash}=useMemo(()=>{
    if(!businessId||!service||!periodValid)return {trial:null,pnl:null,sheet:null,cash:null};
    const input={businessId,dateFrom,dateTo};
    return {trial:service.getTrialBalance(input),pnl:service.getProfitAndLoss(input),sheet:service.getBalanceSheet(input),cash:service.getCashFlow(input)};
  },[businessId,service,periodValid,dateFrom,dateTo]);
  const {ledger,statement}=useMemo(()=>{
    if(!businessId||!service||!periodValid||!accounts.some(account=>account.id===selectedAccountId))return {ledger:null,statement:null};
    const input={businessId,accountId:selectedAccountId,dateFrom,dateTo};
    return {ledger:service.getGeneralLedger(input),statement:service.getAccountStatement(input)};
  },[businessId,service,periodValid,dateFrom,dateTo,accounts,selectedAccountId]);

  const rowData = report === 'ledger' ? ledger : report === 'trial' ? trial : report === 'pnl' ? pnl : report === 'sheet' ? sheet : report === 'cash' ? cash : statement;

  const buttonLabels: Record<string, string> = {
    ledger: 'General Ledger',
    statement: 'Account Statement',
    trial: 'Trial Balance',
    pnl: 'Profit & Loss',
    sheet: 'Balance Sheet',
    cash: 'Cash Flow',
  };

  if (!businessId) {
    return (
      <main className="opsfinance-workflow-panel" style={{ padding: '2rem' }}>
        <div className="opsfinance-surface" style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <h1 style={{ margin: 0 }}>{w("Financial Reports")}</h1>
          <div className="opsfinance-action-row">
            {Object.entries(buttonLabels).map(([key, label]) => (
              <button key={key} type="button" className="opsfinance-secondary-button" style={{ minHeight: '40px' }}>
                {w(label)}
              </button>
            ))}
          </div>
          <div className="opsfinance-form-grid">
            <label><span>{w("Start date")}</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
            <label><span>{w("End date")}</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
            <label><span>{w("Account")}</span><select value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)}><option value="">{w("None selected")}</option></select></label>
          </div>
          <p style={{ margin: 0, color: '#475569' }}>{businessContextError ?? w("No active business for reports.")}</p>
        </div>
      </main>
    );
  }

  if (error) {
    return <main style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}><div role="alert" style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 18, padding: '1.5rem' }}>{w(error)}</div><button type="button" onClick={()=>setRefreshVersion(value=>value+1)}>{w("Refresh")}</button></main>;
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: '1.5rem 1rem 2rem', fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gap: '1rem' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <p style={{ margin: 0, color: '#475569', letterSpacing: '0.08em', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>OpsFinance</p>
            <h1 style={{ margin: '0.35rem 0 0' }}>{w("Financial Reports")}</h1>
            <button type="button" className="opsfinance-secondary-button" disabled={loading} onClick={()=>setRefreshVersion(value=>value+1)}>{w("Refresh")}</button>
            <button type="button" className="opsfinance-secondary-button" disabled={loading || !rowData} onClick={async () => {
              if (loading || !rowData) return;
              let csv:string;
              if(isPreviewAuthBypassEnabled()) csv=reportCsv(rowData,{report:buttonLabels[report],business:businessId,from:dateFrom,to:dateTo});
              else {
                try {
                  const response=await fetch('/api/reports/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({businessId,report:rowData,label:buttonLabels[report],from:dateFrom,to:dateTo})});
                  if(!response.ok){const result=await response.json();setError(result.error||'Report export unavailable.');return;}
                  csv=await response.text();
                }catch{setError('Report export unavailable. Try again.');return;}
              }
              const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
              const link = document.createElement('a');
              link.href = url; link.download = `opsfinance-${report}-${dateFrom}-${dateTo}.csv`;
              link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}>{w("Export CSV")}</button>
          </div>
        </header>

        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {['ledger', 'statement', 'trial', 'pnl', 'sheet', 'cash'].map((key) => (
              <button key={key} type="button" onClick={() => setReport(key as any)} style={{ border: 'none', background: report === key ? '#0f172a' : '#e2e8f0', color: report === key ? '#fff' : '#0f172a', borderRadius: 10, padding: '0.7rem 0.9rem', fontWeight: 700, cursor: 'pointer' }}>
                {w(buttonLabels[key])}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>{w("Start date")}</span>
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>{w("End date")}</span>
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>{w("Account")}</span>
              <select value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)}>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </label>
          </div>
        </section>

        {!periodValid ? <p role="alert">{w("Choose a valid start and end date. The start date must not be after the end date.")}</p> : null}
        {loading ? <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '1.25rem' }}>{w("Loading real reporting data…")}</div> : null}

        {!loading && rowData ? (
          <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '1rem' }}>
            {report === 'trial' ? (
              <div>
                <h2>{w("Trial Balance")}</h2>
                <p>{w("Total Debit:")} {formatMoney(trial?.totalDebit ?? '0.00')} {w("/ Total Credit:")} {formatMoney(trial?.totalCredit ?? '0.00')}</p>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr><th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>{w("Account")}</th><th style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>{w("Debit")}</th><th style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>{w("Credit")}</th></tr>
                  </thead>
                  <tbody>
                    {(trial?.rows ?? []).map((row: any) => (
                      <tr key={row.accountId}><td style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>{row.accountName}</td><td style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>{formatMoney(row.debit)}</td><td style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>{formatMoney(row.credit)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {report === 'pnl' ? (
              <div>
                <h2>{w("P&L")}</h2>
                <p>{w("Revenue:")} {formatMoney(pnl?.revenueTotal ?? '0.00')} {w("/ Expenses:")} {formatMoney(pnl?.expensesTotal ?? '0.00')} {w("/ Net Profit:")} {formatMoney(pnl?.netProfit ?? '0.00')}</p>
              </div>
            ) : null}

            {report === 'sheet' ? (
              <div>
                <h2>{w("Balance Sheet")}</h2>
                <p>{w("Total Assets:")} {formatMoney(sheet?.totalAssets ?? '0.00')} {w("/ Total Liabilities:")} {formatMoney(sheet?.totalLiabilities ?? '0.00')} {w("/ Total Equity:")} {formatMoney(sheet?.totalEquity ?? '0.00')}</p>
              </div>
            ) : null}

            {report === 'cash' ? (
              <div>
                <h2>{w("Cash Flow")}</h2>
                <p>{w("Closing Cash:")} {formatMoney(cash?.closingCash ?? '0.00')} {w("/ Net Cash Flow:")} {formatMoney(cash?.netCashFlow ?? '0.00')}</p>
              </div>
            ) : null}

            {report === 'ledger' ? (
              <div>
                <h2>{w("General Ledger")}</h2>
                <p>{w("Closing Balance:")} {formatMoney(ledger?.closingBalance ?? '0.00')}</p>
                <ReportTransactions rows={ledger?.rows ?? []} />
              </div>
            ) : null}

            {report === 'statement' ? (
              <div>
                <h2>{w("Account Statement")}</h2>
                <p>{w("Closing Balance:")} {formatMoney(statement?.closingBalance ?? '0.00')}</p>
                <ReportTransactions rows={statement?.transactions ?? []} />
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
