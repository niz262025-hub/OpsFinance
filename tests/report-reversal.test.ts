import { describe, expect, it } from 'vitest';
import { AccountingEngine, type JournalLineInput } from '../packages/accounting';
import { FinancialReportService } from '../packages/reports';

const businessId = '11111111-1111-4111-8111-111111111111';
const cash = '22222222-2222-4222-8222-222222222222';
const revenue = '33333333-3333-4333-8333-333333333333';
const expense = '44444444-4444-4444-8444-444444444444';
const cogs = '55555555-5555-4555-8555-555555555555';
function fixture() {
  const engine = new AccountingEngine({ businessId, accounts: [
    { id: cash, businessId, code: '1100', name: 'Cash', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: false, isActive: true },
    { id: revenue, businessId, code: '4100', name: 'Sales', accountType: 'REVENUE', normalBalance: 'CREDIT', isSystem: false, isActive: true },
    { id: expense, businessId, code: '5100', name: 'Expense', accountType: 'EXPENSE', normalBalance: 'DEBIT', isSystem: false, isActive: true },
    { id: cogs, businessId, code: '5500', name: 'Cost', accountType: 'COGS', normalBalance: 'DEBIT', isSystem: false, isActive: true },
  ], periods: [{ id: 'period', businessId, name: '2026-10', startDate: '2026-10-01', endDate: '2026-10-31', status: 'OPEN' }] });
  let n = 0;
  const post = (lines: JournalLineInput[]) => {
    const key = `UAT-${++n}`;
    const journal = engine.createJournal({ businessId, journalNo: key, journalDate: '2026-10-05', sourceType: 'MANUAL', lines });
    engine.postJournal(journal, { postedBy: 'tester', idempotencyKey: key });
  };
  post([{ accountId: cash, debit: '100.00' }, { accountId: revenue, credit: '100.00' }]);
  post([{ accountId: expense, debit: '30.00' }, { accountId: cash, credit: '30.00' }]);
  post([{ accountId: cogs, debit: '20.00' }, { accountId: cash, credit: '20.00' }]);
  const report = () => new FinancialReportService(engine).getProfitAndLoss({ businessId, dateFrom: '2026-10-01', dateTo: '2026-10-31' });
  return { post, report };
}

describe('P&L signed refunds and reversals', () => {
  it('preserves ordinary revenue, expense and COGS totals', () => {
    const p = fixture().report();
    expect([p.revenueTotal, p.expensesTotal, p.cogsTotal, p.netProfit]).toEqual(['100.00', '30.00', '20.00', '50.00']);
  });
  it('fully reversed posted activity nets to zero', () => {
    const { post, report } = fixture();
    post([{ accountId: revenue, debit: '100.00' }, { accountId: cash, credit: '100.00' }]);
    post([{ accountId: cash, debit: '30.00' }, { accountId: expense, credit: '30.00' }]);
    post([{ accountId: cash, debit: '20.00' }, { accountId: cogs, credit: '20.00' }]);
    const p = report();
    expect([p.revenueTotal, p.expensesTotal, p.cogsTotal, p.netProfit]).toEqual(['0.00', '0.00', '0.00', '0.00']);
  });
  it('subtracts a partial revenue refund', () => {
    const { post, report } = fixture();
    post([{ accountId: revenue, debit: '40.00' }, { accountId: cash, credit: '40.00' }]);
    expect(report().netProfit).toBe('10.00');
  });
  it('retains negative net income and cost sections when refunds exceed current-period activity', () => {
    const { post, report } = fixture();
    post([{ accountId: revenue, debit: '150.00' }, { accountId: cash, credit: '150.00' }]);
    post([{ accountId: cash, debit: '40.00' }, { accountId: expense, credit: '40.00' }]);
    post([{ accountId: cash, debit: '25.00' }, { accountId: cogs, credit: '25.00' }]);
    const p = report();
    expect([p.revenueTotal, p.expensesTotal, p.cogsTotal, p.netProfit]).toEqual(['-50.00', '-10.00', '-5.00', '-35.00']);
    expect(p.sections.revenue[0].amount).toBe('-50.00');
    expect(p.sections.expenses[0].amount).toBe('-10.00');
    expect(p.sections.cogs[0].amount).toBe('-5.00');
  });
});
