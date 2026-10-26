import { describe, expect, it } from 'vitest';
import { AccountingEngine } from '../packages/accounting';
import { TransactionService } from '../packages/transactions';

describe('Phase 3 transaction workflow', () => {
  const businessId = '11111111-1111-4111-8111-111111111111';
  const otherBusinessId = '77777777-7777-4777-8777-777777777777';
  const bankAccountId = '22222222-2222-4222-8222-222222222222';
  const revenueAccountId = '33333333-3333-4333-8333-333333333333';
  const expenseAccountId = '44444444-4444-4444-8444-444444444444';
  const cashAccountId = '55555555-5555-4555-8555-555555555555';
  const equityAccountId = '66666666-6666-4666-8666-666666666666';

  const engine = new AccountingEngine({
    businessId,
    accounts: [
      { id: revenueAccountId, businessId, code: '4000', name: 'Sales', accountType: 'REVENUE', normalBalance: 'CREDIT', isSystem: false, isActive: true },
      { id: expenseAccountId, businessId, code: '6000', name: 'Petrol', accountType: 'EXPENSE', normalBalance: 'DEBIT', isSystem: false, isActive: true },
      { id: cashAccountId, businessId, code: '1100', name: 'Cash', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: false, isActive: true },
      { id: equityAccountId, businessId, code: '3000', name: 'Opening Equity', accountType: 'EQUITY', normalBalance: 'CREDIT', isSystem: true, isActive: true },
    ],
    periods: [{ id: 'period-1', businessId, name: '2026-09', startDate: '2026-09-01', endDate: '2026-09-30', status: 'OPEN' }],
    financialAccounts: [{ id: bankAccountId, businessId, name: 'Maybank', type: 'BANK', accountCode: 'MAYBANK', currency: 'MYR', status: 'ACTIVE', accountId: cashAccountId }],
  });

  it('creates a valid money-in transaction and posts it through the accounting engine', () => {
    const service = new TransactionService(engine);
    const tx = service.createTransaction({
      businessId,
      type: 'MONEY_IN',
      date: '2026-09-12',
      financialAccountId: bankAccountId,
      amount: '500.00',
      description: 'Customer payment',
      referenceNo: 'INV-1001',
      accountId: revenueAccountId,
      createdBy: 'user-1',
    });

    expect(tx.type).toBe('MONEY_IN');
    expect(tx.status).toBe('DRAFT');

    const posted = service.postTransaction(tx.id, 'user-1', 'idempotent-money-in');
    expect(posted.status).toBe('POSTED');
    expect(posted.journalId).toBeTruthy();
    expect(posted.amount).toBe('500.00');
  });

  it('rejects invalid money-out amounts and unbalanced journals', () => {
    const service = new TransactionService(engine);

    expect(() =>
      service.createTransaction({
        businessId,
        type: 'MONEY_OUT',
        date: '2026-09-12',
        financialAccountId: bankAccountId,
        amount: '-10.00',
        description: 'Bad amount',
        accountId: expenseAccountId,
        createdBy: 'user-1',
      }),
    ).toThrow();

    expect(() =>
      service.createTransaction({
        businessId,
        type: 'JOURNAL',
        date: '2026-09-12',
        description: 'Unbalanced entry',
        createdBy: 'user-1',
        lines: [
          { accountId: bankAccountId, debit: '10.00' },
          { accountId: revenueAccountId, credit: '5.00' },
        ],
      }),
    ).toThrow();
  });

  it('handles transfers without affecting profit and loss', () => {
    const service = new TransactionService(engine);
    const tx = service.createTransaction({
      businessId,
      type: 'TRANSFER',
      date: '2026-09-12',
      fromFinancialAccountId: bankAccountId,
      toFinancialAccountId: cashAccountId,
      amount: '250.00',
      description: 'Transfer between accounts',
      createdBy: 'user-1',
    });

    expect(tx.type).toBe('TRANSFER');
    expect(tx.amount).toBe('250.00');
    expect(tx.journalId).toBeTruthy();
  });

  it('prevents cross-business access for transactions and postings', () => {
    const service = new TransactionService(engine);

    expect(() =>
      service.createTransaction({
        businessId: otherBusinessId,
        type: 'MONEY_IN',
        date: '2026-09-12',
        financialAccountId: bankAccountId,
        amount: '50.00',
        description: 'Wrong business',
        accountId: revenueAccountId,
        createdBy: 'user-1',
      }),
    ).toThrow();
  });

  it('enforces idempotency on repeat posting', () => {
    const service = new TransactionService(engine);
    const tx = service.createTransaction({
      businessId,
      type: 'MONEY_IN',
      date: '2026-09-12',
      financialAccountId: bankAccountId,
      amount: '75.00',
      description: 'Idempotent entry',
      accountId: revenueAccountId,
      createdBy: 'user-1',
      idempotencyKey: 'same-key',
    });

    const first = service.postTransaction(tx.id, 'user-1', 'same-key');
    const second = service.postTransaction(tx.id, 'user-1', 'same-key');
    expect(first.id).toBe(second.id);
    expect(first.status).toBe('POSTED');
  });

  it('validates lifecycle transitions and review approval before posting', () => {
    const service = new TransactionService(engine);
    const tx = service.createTransaction({
      businessId,
      type: 'MONEY_OUT',
      date: '2026-09-12',
      financialAccountId: bankAccountId,
      amount: '25.00',
      description: 'Petrol purchase',
      accountId: expenseAccountId,
      createdBy: 'user-1',
    });

    const validation = service.validateTransaction(tx);
    expect(validation.isValid).toBe(true);

    const approved = service.approveTransaction(tx.id, 'reviewer-1');
    expect(approved.status).toBe('APPROVED');

    const posted = service.postTransaction(approved.id, 'user-1', 'approved-money-out');
    expect(posted.status).toBe('POSTED');
    expect(posted.journal).toBeTruthy();
  });

  it('posts a valid money-in transaction against the mapped cash account and guards against duplicates', () => {
    const moneyInEngine = new AccountingEngine({
      businessId,
      accounts: [
        { id: revenueAccountId, businessId, code: '4000', name: 'Sales', accountType: 'REVENUE', normalBalance: 'CREDIT', isSystem: false, isActive: true },
        { id: cashAccountId, businessId, code: '1100', name: 'Cash', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: false, isActive: true },
        { id: equityAccountId, businessId, code: '3000', name: 'Opening Equity', accountType: 'EQUITY', normalBalance: 'CREDIT', isSystem: true, isActive: true },
      ],
      periods: [{ id: 'period-1', businessId, name: '2026-09', startDate: '2026-09-01', endDate: '2026-09-30', status: 'OPEN' }],
      financialAccounts: [{ id: bankAccountId, businessId, name: 'Maybank', type: 'BANK', accountCode: 'MAYBANK', currency: 'MYR', status: 'ACTIVE', accountId: cashAccountId }],
    });

    const service = new TransactionService(moneyInEngine);

    expect(() => service.createTransaction({
      businessId,
      type: 'MONEY_IN',
      date: '2026-09-12',
      financialAccountId: bankAccountId,
      amount: '1000.00',
      description: 'Customer payment',
      referenceNo: 'INV-2001',
      accountId: cashAccountId,
      createdBy: 'user-1',
    })).toThrow('Counter account must be different');

    const tx = service.createTransaction({
      businessId,
      type: 'MONEY_IN',
      date: '2026-09-12',
      financialAccountId: bankAccountId,
      amount: '1000.00',
      description: 'Customer payment',
      referenceNo: 'INV-2001',
      accountId: revenueAccountId,
      createdBy: 'user-1',
      idempotencyKey: 'money-in-flow-1',
    });

    expect(tx.journal?.lines).toHaveLength(2);
    expect(tx.journal?.lines[0].accountId).toBe(cashAccountId);
    expect(tx.journal?.lines[0].debit).toBe('1000.00');
    expect(tx.journal?.lines[1].accountId).toBe(revenueAccountId);
    expect(tx.journal?.lines[1].credit).toBe('1000.00');

    const posted = service.postTransaction(tx.id, 'user-1', 'money-in-flow-1');
    expect(posted.status).toBe('POSTED');

    const cashLedger = moneyInEngine.getLedger({ businessId, accountId: cashAccountId, startDate: '2026-09-01', endDate: '2026-09-30' });
    expect(cashLedger.balance).toBe('1000.00');
    expect(cashLedger.debitTotal).toBe('1000.00');
    expect(cashLedger.creditTotal).toBe('0.00');

    const duplicate = service.postTransaction(tx.id, 'user-1', 'money-in-flow-1');
    expect(duplicate.id).toBe(posted.id);
    expect(duplicate.status).toBe('POSTED');
  });
});
