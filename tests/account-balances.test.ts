import { describe, expect, it, vi } from 'vitest';
import { AccountingEngine, type BusinessAccount, type JournalEntry } from '../packages/accounting';
import { FinancialReportService } from '../packages/reports';

const businessId = 'business-a';
const accounts = [
  ['cash', 'ASSET', 'DEBIT'], ['contra', 'ASSET', 'CREDIT'], ['debt', 'LIABILITY', 'CREDIT'],
  ['equity', 'EQUITY', 'CREDIT'], ['sales', 'REVENUE', 'CREDIT'], ['cost', 'COGS', 'DEBIT'],
  ['expense', 'EXPENSE', 'DEBIT'], ['empty', 'ASSET', 'DEBIT'],
].map(([id, accountType, normalBalance], i) => ({ id, businessId, name: id, code: String(i), accountType, normalBalance, isActive: true })) as BusinessAccount[];
function journal(id: string, debitAccount: string, creditAccount: string, amount: string): JournalEntry {
  return { id, businessId, journalNo: id, journalDate: '2026-11-07', createdAt: '2026-11-07T00:00:00Z', status: 'POSTED', sourceType: 'MANUAL', lines: [
    { accountId: debitAccount, debit: amount, credit: '0.00' },
    { accountId: creditAccount, debit: '0.00', credit: amount },
  ] } as JournalEntry;
}
function fixture() {
  const opening = { ...journal('OB-1', 'cash', 'equity', '1000.00'), sourceType: 'SYSTEM' } as JournalEntry;
  const journals = [journal('sale', 'cash', 'sales', '125.25'), journal('refund', 'sales', 'cash', '25.10'),
    journal('expense', 'expense', 'cash', '12.34'), journal('contra', 'expense', 'contra', '0.11'),
    journal('loan', 'cash', 'debt', '50.55'), journal('cost', 'cost', 'cash', '10.00'), opening];
  const repository = { getBusinessAccounts: vi.fn(() => accounts), getPostedJournals: vi.fn(() => journals) };
  const service = new FinancialReportService({ engine: new AccountingEngine({ businessId, accounts }), repository });
  return { journals, repository, service };
}
describe('single-pass account balance summaries', () => {
  it('subtracts a credit-normal contra asset from balance sheet assets', () => {
    const { service } = fixture();
    const sheet = service.getBalanceSheet({ businessId, dateFrom: '2026-11-07', dateTo: '2026-11-07' });
    expect(sheet.assets.find(row => row.accountId === 'contra')?.amount).toBe('-0.11');
    expect(sheet.totalAssets).toBe('1128.25');
    expect(sheet.totalLiabilities).toBe('50.55');
    expect(sheet.totalEquity).toBe('1077.70');
    expect(sheet.isBalanced).toBe(true);
  });

  it('matches every original statement closing balance including opening entries, refunds and credit-normal assets', () => {
    const { service, repository } = fixture();
    const result = service.getAccountBalances({ businessId });
    expect(repository.getBusinessAccounts).toHaveBeenCalledOnce();
    expect(repository.getPostedJournals).toHaveBeenCalledOnce();
    expect(result.map(row => row.accountId)).toEqual(accounts.map(account => account.id));
    for (const row of result) expect(row.closingBalance).toBe(service.getAccountStatement({ businessId, accountId: row.accountId }).closingBalance);
    expect(result.find(row => row.accountId === 'cash')?.closingBalance).toBe('1128.36');
    expect(result.find(row => row.accountId === 'contra')?.closingBalance).toBe('0.11');
    expect(result.find(row => row.accountId === 'empty')?.closingBalance).toBe('0.00');
  });
  it('denies another business before reading the repository', () => {
    const { service, repository } = fixture();
    expect(() => service.getAccountBalances({ businessId: 'business-b' })).toThrow();
    expect(repository.getPostedJournals).not.toHaveBeenCalled();
    expect(repository.getBusinessAccounts).not.toHaveBeenCalled();
  });
  it('excludes foreign accounts, foreign journals and unposted records even if a repository is mis-scoped', () => {
    const { service, repository, journals } = fixture();
    const expected = service.getAccountBalances({ businessId });
    repository.getBusinessAccounts.mockReturnValue([...accounts, { ...accounts[0], id: 'foreign', businessId: 'business-b' }]);
    journals.push({ ...journal('foreign', 'cash', 'sales', '99999.00'), businessId: 'business-b' });
    journals.push({ ...journal('draft', 'cash', 'sales', '99999.00'), status: 'DRAFT' } as JournalEntry);
    expect(service.getAccountBalances({ businessId })).toEqual(expected);
  });
  it('uses exact cents beyond floating-point precision and reads a fresh snapshot on the next call', () => {
    const { service, journals } = fixture();
    journals.splice(0, journals.length, journal('large', 'cash', 'equity', '90071992547409.91'));
    expect(service.getAccountBalances({ businessId })[0].closingBalance).toBe('90071992547409.91');
    journals.push(journal('cents', 'cash', 'sales', '0.09'));
    expect(service.getAccountBalances({ businessId })[0].closingBalance).toBe('90071992547410.00');
  });
});
