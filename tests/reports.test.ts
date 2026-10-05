import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import {
  AccountingEngine,
  createOpeningBalanceJournal,
  DecimalMoney,
  type JournalLineInput,
} from '../packages/accounting';
import { DashboardWorkflow } from '../components/dashboard-workflow';
import { ReportsWorkflow } from '../components/reports-workflow';
import { FinancialReportService } from '../packages/reports';

describe('Phase 6 financial reporting', () => {
  const businessId = '11111111-1111-4111-8111-111111111111';
  const bankAccountId = '22222222-2222-4222-8222-222222222222';
  const cashAccountId = '55555555-5555-4555-8555-555555555555';
  const salesAccountId = '33333333-3333-4333-8333-333333333333';
  const rentalAccountId = '44444444-4444-4444-8444-444444444444';
  const petrolAccountId = '66666666-6666-4666-8666-666666666666';
  const bankChargeAccountId = '77777777-7777-4777-8777-777777777777';
  const equityAccountId = '88888888-8888-4888-8888-888888888888';
  const otherBusinessId = '99999999-9999-4999-8999-999999999999';

  function buildEngine() {
    const engine = new AccountingEngine({
      businessId,
      accounts: [
        { id: salesAccountId, businessId, code: '4000', name: 'Sales', accountType: 'REVENUE', normalBalance: 'CREDIT', isSystem: false, isActive: true },
        { id: rentalAccountId, businessId, code: '6500', name: 'Rental', accountType: 'EXPENSE', normalBalance: 'DEBIT', isSystem: false, isActive: true },
        { id: petrolAccountId, businessId, code: '6200', name: 'Petrol', accountType: 'EXPENSE', normalBalance: 'DEBIT', isSystem: false, isActive: true },
        { id: bankChargeAccountId, businessId, code: '6900', name: 'Bank Charges', accountType: 'EXPENSE', normalBalance: 'DEBIT', isSystem: false, isActive: true },
        { id: bankAccountId, businessId, code: '1100', name: 'Maybank', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: false, isActive: true },
        { id: cashAccountId, businessId, code: '1110', name: 'Cash', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: false, isActive: true },
        { id: equityAccountId, businessId, code: '3000', name: 'Capital', accountType: 'EQUITY', normalBalance: 'CREDIT', isSystem: true, isActive: true },
      ],
      periods: [{ id: 'period-1', businessId, name: '2026-09', startDate: '2026-09-01', endDate: '2026-09-30', status: 'OPEN' }],
      financialAccounts: [
        { id: bankAccountId, businessId, name: 'Maybank', type: 'BANK', accountCode: 'MAYBANK', currency: 'MYR', status: 'ACTIVE' },
        { id: cashAccountId, businessId, name: 'Cash', type: 'CASH', accountCode: 'CASH', currency: 'MYR', status: 'ACTIVE' },
      ],
    });

    const opening = engine.createJournal(createOpeningBalanceJournal({
      businessId,
      journalDate: '2026-09-01',
      financialAccountId: bankAccountId,
      openingEquityAccountId: equityAccountId,
      amount: '10000.00',
      description: 'Opening balance',
    }));
    engine.postJournal(opening, { postedBy: 'system', idempotencyKey: 'opening-balance' });

    const sales = engine.createJournal({
      businessId,
      journalNo: 'J-SALES-1',
      journalDate: '2026-09-12',
      sourceType: 'MANUAL',
      description: 'Sales receipt',
      lines: [
        { accountId: bankAccountId, debit: '5000.00', description: 'Customer payment' },
        { accountId: salesAccountId, credit: '5000.00', description: 'Sales revenue' },
      ],
    });
    engine.postJournal(sales, { postedBy: 'user-1', idempotencyKey: 'sales-1' });

    const rental = engine.createJournal({
      businessId,
      journalNo: 'J-RENT-1',
      journalDate: '2026-09-15',
      sourceType: 'MANUAL',
      description: 'Rental expense',
      lines: [
        { accountId: rentalAccountId, debit: '1000.00', description: 'Rental' },
        { accountId: bankAccountId, credit: '1000.00', description: 'Rent payment' },
      ],
    });
    engine.postJournal(rental, { postedBy: 'user-1', idempotencyKey: 'rental-1' });

    const petrol = engine.createJournal({
      businessId,
      journalNo: 'J-PETROL-1',
      journalDate: '2026-09-18',
      sourceType: 'MANUAL',
      description: 'Petrol expense',
      lines: [
        { accountId: petrolAccountId, debit: '300.00', description: 'Fuel' },
        { accountId: bankAccountId, credit: '300.00', description: 'Fuel payment' },
      ],
    });
    engine.postJournal(petrol, { postedBy: 'user-1', idempotencyKey: 'petrol-1' });

    const bankCharge = engine.createJournal({
      businessId,
      journalNo: 'J-BANK-CHG-1',
      journalDate: '2026-09-19',
      sourceType: 'MANUAL',
      description: 'Bank charge',
      lines: [
        { accountId: bankChargeAccountId, debit: '10.00', description: 'Bank charge' },
        { accountId: bankAccountId, credit: '10.00', description: 'Bank service fee' },
      ],
    });
    engine.postJournal(bankCharge, { postedBy: 'user-1', idempotencyKey: 'bank-charge-1' });

    const transfer = engine.createJournal({
      businessId,
      journalNo: 'J-TRF-1',
      journalDate: '2026-09-20',
      sourceType: 'MANUAL',
      description: 'Transfer from Maybank to Cash',
      lines: [
        { accountId: cashAccountId, debit: '1000.00', description: 'Cash transfer in' },
        { accountId: bankAccountId, credit: '1000.00', description: 'Transfer to cash' },
      ],
    });
    engine.postJournal(transfer, { postedBy: 'user-1', idempotencyKey: 'transfer-1' });

    return engine;
  }

  it('can read from an injected repository instead of the in-memory engine maps', () => {
    const engine = buildEngine();
    const repository = {
      getBusinessAccounts: () => [...((engine as any).accounts as Map<string, any>).values()].filter((account) => account.businessId === businessId),
      getPostedJournals: () => [...((engine as any).journals as Map<string, any>).values()].filter((journal) => journal.businessId === businessId && journal.status === 'POSTED'),
      getAccount: (_businessId: string, accountId: string) => [...((engine as any).accounts as Map<string, any>).values()].find((account) => account.id === accountId),
    };
    const reports = new FinancialReportService(engine, { repository });
    const trial = reports.getTrialBalance({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });

    expect(trial.isBalanced).toBe(true);
    expect(trial.totalDebit).toBe(trial.totalCredit);
  });

  it('builds a general ledger from posted journal lines and keeps a running balance', () => {
    const engine = buildEngine();
    const reports = new FinancialReportService(engine);
    const ledger = reports.getGeneralLedger({
      businessId,
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      accountId: bankAccountId,
    });

    expect(ledger.rows.length).toBeGreaterThan(0);
    expect(ledger.openingBalance).toBe('10000.00');
    expect(ledger.closingBalance).toBe('12690.00');
    expect(Number(ledger.totalDebit)).toBeGreaterThan(0);
    expect(Number(ledger.totalCredit)).toBeGreaterThan(0);
    expect(ledger.rows[0].balance).toBeDefined();
  });

  it('builds an account statement with opening, movement, and closing balances', () => {
    const engine = buildEngine();
    const reports = new FinancialReportService(engine);
    const statement = reports.getAccountStatement({
      businessId,
      accountId: bankAccountId,
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
    });

    expect(statement.openingBalance).toBe('10000.00');
    expect(statement.closingBalance).toBe('12690.00');
    expect(statement.transactions.length).toBeGreaterThan(0);
    expect(statement.transactions[0].runningBalance).toBeDefined();
  });

  it('produces a balanced trial balance from posted journal lines only', () => {
    const engine = buildEngine();
    const reports = new FinancialReportService(engine);
    const trial = reports.getTrialBalance({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });

    expect(trial.isBalanced).toBe(true);
    expect(Number(trial.totalDebit)).toBeGreaterThan(0);
    expect(Number(trial.totalCredit)).toBeGreaterThan(0);
    expect(trial.totalDebit).toBe(trial.totalCredit);
  });

  it('computes profit and loss from posted revenue and expense activity only', () => {
    const engine = buildEngine();
    const reports = new FinancialReportService(engine);
    const pnl = reports.getProfitAndLoss({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });

    expect(pnl.revenueTotal).toBe('5000.00');
    expect(pnl.cogsTotal).toBe('0.00');
    expect(pnl.expensesTotal).toBe('1310.00');
    expect(pnl.netProfit).toBe('3690.00');
  });

  it('enforces the accounting equation in the balance sheet', () => {
    const engine = buildEngine();
    const reports = new FinancialReportService(engine);
    const sheet = reports.getBalanceSheet({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });

    expect(sheet.isBalanced).toBe(true);
    expect(Number(sheet.totalAssets)).toBe(Number(sheet.totalLiabilities) + Number(sheet.totalEquity));
  });

  it('derives cash flow from posted cash and bank activity', () => {
    const engine = buildEngine();
    const reports = new FinancialReportService(engine);
    const cashFlow = reports.getCashFlow({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });

    expect(cashFlow.openingCash).toBe('10000.00');
    expect(cashFlow.closingCash).toBe('13690.00');
    expect(cashFlow.netCashFlow).toBe('3690.00');
  });

  it('prevents cross-business report access', () => {
    const engine = buildEngine();
    const reports = new FinancialReportService(engine);

    expect(() => reports.getGeneralLedger({ businessId: otherBusinessId })).toThrow();
    expect(() => reports.getAccountStatement({ businessId: otherBusinessId, accountId: bankAccountId })).toThrow();
    expect(() => reports.getTrialBalance({ businessId: otherBusinessId })).toThrow();
    expect(() => reports.getProfitAndLoss({ businessId: otherBusinessId })).toThrow();
    expect(() => reports.getBalanceSheet({ businessId: otherBusinessId })).toThrow();
    expect(() => reports.getCashFlow({ businessId: otherBusinessId })).toThrow();
  });

  it('rejects cross-business account IDs in report queries', () => {
    const engine = buildEngine();
    const reports = new FinancialReportService(engine);

    const foreignAccountId = `${bankAccountId}-foreign`;
    expect(() => reports.getGeneralLedger({ businessId, accountId: foreignAccountId })).toThrow('does not belong to this business');
    expect(() => reports.getAccountStatement({ businessId, accountId: foreignAccountId })).toThrow('does not belong to this business');
  });

  it('uses deterministic DecimalMoney calculations and excludes unposted entries', () => {
    const engine = buildEngine();
    const reports = new FinancialReportService(engine);
    const statement = reports.getAccountStatement({ businessId, accountId: bankAccountId });

    expect(statement.transactions.some((row) => row.journalNo === 'DRAFT-1')).toBe(false);
    expect(statement.transactions.every((row) => row.debit !== '0.01' || row.credit !== '0.01')).toBe(true);
    expect(statement.closingBalance).toBe('12690.00');
  });

  it('supports realistic end-to-end accounting scenario reconciliation', () => {
    const engine = buildEngine();
    const reports = new FinancialReportService(engine);

    const gl = reports.getGeneralLedger({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    const trial = reports.getTrialBalance({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    const pnl = reports.getProfitAndLoss({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    const sheet = reports.getBalanceSheet({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    const cashFlow = reports.getCashFlow({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });

    expect(gl.rows.length).toBeGreaterThan(0);
    expect(trial.isBalanced).toBe(true);
    expect(sheet.isBalanced).toBe(true);
    expect(pnl.netProfit).toBeDefined();
    expect(cashFlow.closingCash).toBeDefined();
  });

  it('reconciles the six reports against the same canonical posted accounting source', () => {
    const engine = buildEngine();
    const reports = new FinancialReportService(engine);

    const statement = reports.getAccountStatement({ businessId, accountId: bankAccountId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    const gl = reports.getGeneralLedger({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30', accountId: bankAccountId });
    const trial = reports.getTrialBalance({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    const pnl = reports.getProfitAndLoss({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    const sheet = reports.getBalanceSheet({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    const cash = reports.getCashFlow({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });

    expect(gl.openingBalance).toBe('10000.00');
    expect(gl.closingBalance).toBe(statement.closingBalance);
    expect(trial.totalDebit).toBe(trial.totalCredit);
    expect(sheet.isBalanced).toBe(true);
    expect(Number(sheet.totalAssets)).toBe(Number(sheet.totalLiabilities) + Number(sheet.totalEquity));
    expect(statement.openingBalance).toBe('10000.00');
    expect(statement.closingBalance).toBe('12690.00');
    expect(cash.openingCash).toBe('10000.00');
    expect(cash.closingCash).toBe('13690.00');
    expect(pnl.netProfit).toBe('3690.00');
  });

  it('handles opening balance before the period, on the start date, and avoids double-counting', () => {
    const engine = buildEngine();
    const reports = new FinancialReportService(engine);

    const beforeStart = reports.getAccountStatement({ businessId, accountId: bankAccountId, dateFrom: '2026-09-10', dateTo: '2026-09-30' });
    const exactStart = reports.getAccountStatement({ businessId, accountId: bankAccountId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    const allTime = reports.getAccountStatement({ businessId, accountId: bankAccountId });

    expect(beforeStart.openingBalance).toBe('10000.00');
    expect(exactStart.openingBalance).toBe('10000.00');
    expect(allTime.closingBalance).toBe('12690.00');
    expect(exactStart.closingBalance).toBe('12690.00');
    expect(beforeStart.closingBalance).toBe('12690.00');
  });

  it('honors accounting periods and excludes unposted entries from the reports', () => {
    const engine = new AccountingEngine({
      businessId,
      accounts: [
        { id: salesAccountId, businessId, code: '4000', name: 'Sales', accountType: 'REVENUE', normalBalance: 'CREDIT', isSystem: false, isActive: true },
        { id: bankAccountId, businessId, code: '1100', name: 'Maybank', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: false, isActive: true },
        { id: equityAccountId, businessId, code: '3000', name: 'Capital', accountType: 'EQUITY', normalBalance: 'CREDIT', isSystem: true, isActive: true },
      ],
      periods: [{ id: 'period-1', businessId, name: '2026-09', startDate: '2026-09-01', endDate: '2026-09-30', status: 'OPEN' }],
      financialAccounts: [{ id: bankAccountId, businessId, name: 'Maybank', type: 'BANK', accountCode: 'MAYBANK', currency: 'MYR', status: 'ACTIVE' }],
    });

    const opening = engine.createJournal(createOpeningBalanceJournal({
      businessId,
      journalDate: '2026-09-01',
      financialAccountId: bankAccountId,
      openingEquityAccountId: equityAccountId,
      amount: '1000.00',
      description: 'Opening balance',
    }));
    engine.postJournal(opening, { postedBy: 'system', idempotencyKey: 'period-open' });

    const posted = engine.createJournal({
      businessId,
      journalNo: 'J-HIST-1',
      journalDate: '2026-09-05',
      sourceType: 'MANUAL',
      description: 'Historical posted sale',
      lines: [
        { accountId: bankAccountId, debit: '250.00', description: 'Cash' },
        { accountId: salesAccountId, credit: '250.00', description: 'Revenue' },
      ],
    });
    engine.postJournal(posted, { postedBy: 'user-1', idempotencyKey: 'historical-posted' });

    const draft = engine.createJournal({
      businessId,
      journalNo: 'DRAFT-1',
      journalDate: '2026-09-07',
      sourceType: 'MANUAL',
      description: 'Draft entry',
      lines: [
        { accountId: bankAccountId, debit: '44.00', description: 'Draft' },
        { accountId: salesAccountId, credit: '44.00', description: 'Draft' },
      ],
    });

    const reports = new FinancialReportService(engine);
    const trial = reports.getTrialBalance({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    const statement = reports.getAccountStatement({ businessId, accountId: bankAccountId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });

    expect(trial.rows.some((row) => row.accountId === bankAccountId)).toBe(true);
    expect(statement.transactions.some((row) => row.journalNo === 'DRAFT-1')).toBe(false);
    expect(statement.openingBalance).toBe('1000.00');
    expect(statement.closingBalance).toBe('1250.00');
  });

  it('uses DecimalMoney deterministically for cents precision and realistic totals', () => {
    const engine = buildEngine();
    const reports = new FinancialReportService(engine);
    const statement = reports.getAccountStatement({ businessId, accountId: bankAccountId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });

    expect(statement.totalDebit).toBe('5000.00');
    expect(statement.totalCredit).toBe('2310.00');
    expect(statement.closingBalance).toBe('12690.00');
    expect(new DecimalMoney('10.00').add(new DecimalMoney('0.01')).toString()).toBe('10.01');
  });

  it('keeps report reads read-only and does not mutate journals or accounts', () => {
    const engine = buildEngine();
    const reports = new FinancialReportService(engine);
    const before = engine.getLedger({ businessId, accountId: bankAccountId, startDate: '2026-09-01', endDate: '2026-09-30' });

    reports.getGeneralLedger({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30', accountId: bankAccountId });
    reports.getAccountStatement({ businessId, accountId: bankAccountId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    reports.getTrialBalance({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    reports.getProfitAndLoss({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    reports.getBalanceSheet({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    reports.getCashFlow({ businessId, dateFrom: '2026-09-01', dateTo: '2026-09-30' });

    const after = engine.getLedger({ businessId, accountId: bankAccountId, startDate: '2026-09-01', endDate: '2026-09-30' });
    expect(before.balance).toBe(after.balance);
    expect(before.entries.length).toBe(after.entries.length);
  });

  it('renders the actual report tabs, filters, and cash-flow access in the UI', () => {
    render(createElement(ReportsWorkflow));

    expect(screen.getByText('Financial Reports')).toBeTruthy();
    expect(screen.getByRole('button', { name: /General Ledger/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Account Statement/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Trial Balance/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Profit & Loss/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Balance Sheet/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Cash Flow/i })).toBeTruthy();
    expect(screen.getByLabelText(/Start date/i)).toBeTruthy();
    expect(screen.getByLabelText(/End date/i)).toBeTruthy();
    expect(screen.getByLabelText(/Account/i)).toBeTruthy();
  });

  it('renders the dashboard summary using the accounting service layer', () => {
    render(createElement(DashboardWorkflow));

    expect(screen.getByText('OpsFinance Dashboard')).toBeTruthy();
    expect(screen.getByText(/Total Cash/i)).toBeTruthy();
    expect(screen.getByText(/Net Profit/i)).toBeTruthy();
    expect(screen.getByText(/Sales \/ Revenue/i)).toBeTruthy();
    expect(screen.getByText(/Expenses/i)).toBeTruthy();
    expect(screen.getByText(/Financial Account Balances/i)).toBeTruthy();
  });
});
