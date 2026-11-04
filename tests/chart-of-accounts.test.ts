import { describe, expect, it } from 'vitest';

import { AccountingEngine } from '../packages/accounting';
import { ChartOfAccountsService } from '../packages/chart-of-accounts';

describe('chart of accounts service', () => {
  it('lists the configured accounts for a business', () => {
    const engine = new AccountingEngine({
      businessId: 'business-1',
      accounts: [
        { id: 'asset-root', businessId: 'business-1', code: '1000', name: 'Assets', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: true, isActive: true },
        { id: 'cash', businessId: 'business-1', code: '1100', name: 'Cash', accountType: 'ASSET', normalBalance: 'DEBIT', parentId: 'asset-root', isSystem: false, isActive: true },
        { id: 'sales', businessId: 'business-1', code: '4000', name: 'Sales', accountType: 'REVENUE', normalBalance: 'CREDIT', isSystem: false, isActive: true },
      ],
    });

    const svc = new ChartOfAccountsService(engine);
    const accounts = svc.listAccounts('business-1');

    expect(accounts.map((account) => account.code)).toEqual(['1000', '1100', '4000']);
  });

  it('builds parent/child hierarchy', () => {
    const engine = new AccountingEngine({
      businessId: 'business-2',
      accounts: [
        { id: 'asset-root', businessId: 'business-2', code: '1000', name: 'Assets', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: true, isActive: true },
        { id: 'cash', businessId: 'business-2', code: '1100', name: 'Cash', accountType: 'ASSET', normalBalance: 'DEBIT', parentId: 'asset-root', isSystem: false, isActive: true },
      ],
    });

    const svc = new ChartOfAccountsService(engine);
    const hierarchy = svc.getHierarchy('business-2');

    expect(hierarchy[0].children[0].name).toBe('Cash');
    expect(hierarchy[0].children[0].parentName).toBe('Assets');
  });

  it('creates a valid account within the supported COA schema', () => {
    const engine = new AccountingEngine({
      businessId: 'business-3',
      accounts: [
        { id: 'asset-root', businessId: 'business-3', code: '1000', name: 'Assets', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: true, isActive: true },
      ],
    });

    const svc = new ChartOfAccountsService(engine);
    const created = svc.createAccount({
      businessId: 'business-3',
      code: '1100',
      name: 'Cash',
      accountType: 'ASSET',
      parentId: 'asset-root',
      normalBalance: 'DEBIT',
      isActive: true,
    });

    expect(created.code).toBe('1100');
    expect(created.parentId).toBe('asset-root');
    expect(svc.listAccounts('business-3')).toHaveLength(2);
  });

  it('rejects duplicate account codes', () => {
    const engine = new AccountingEngine({
      businessId: 'business-4',
      accounts: [{ id: 'asset-root', businessId: 'business-4', code: '1000', name: 'Assets', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: true, isActive: true }],
    });

    const svc = new ChartOfAccountsService(engine);
    expect(() => svc.createAccount({
      businessId: 'business-4',
      code: '1000',
      name: 'Duplicate',
      accountType: 'ASSET',
      normalBalance: 'DEBIT',
      isActive: true,
    })).toThrow('already exists');
  });

  it('rejects invalid parent relationships', () => {
    const engine = new AccountingEngine({
      businessId: 'business-5',
      accounts: [{ id: 'cash', businessId: 'business-5', code: '1100', name: 'Cash', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: false, isActive: true }],
    });

    const svc = new ChartOfAccountsService(engine);
    expect(() => svc.createAccount({
      businessId: 'business-5',
      code: '1110',
      name: 'Maybank',
      accountType: 'ASSET',
      parentId: 'missing-parent',
      normalBalance: 'DEBIT',
      isActive: true,
    })).toThrow('Parent');
  });

  it('rejects invalid account types', () => {
    const engine = new AccountingEngine({
      businessId: 'business-6',
      accounts: [{ id: 'asset-root', businessId: 'business-6', code: '1000', name: 'Assets', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: true, isActive: true }],
    });

    const svc = new ChartOfAccountsService(engine);
    expect(() => svc.createAccount({
      businessId: 'business-6',
      code: '2000',
      name: 'Invalid',
      accountType: 'OTHER' as never,
      normalBalance: 'DEBIT',
      isActive: true,
    })).toThrow('account type');
  });

  it('supports credit-normal contra assets and rejects invalid expense balances', () => {
    const engine = new AccountingEngine({
      businessId: 'business-7',
      accounts: [{ id: 'asset-root', businessId: 'business-7', code: '1000', name: 'Assets', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: true, isActive: true }],
    });

    const svc = new ChartOfAccountsService(engine);
    const contraAsset = svc.createAccount({
      businessId: 'business-7',
      code: '1590',
      name: 'Accumulated Depreciation',
      accountType: 'ASSET',
      normalBalance: 'CREDIT',
      parentId: 'asset-root',
      isActive: true,
    });
    expect(contraAsset.normalBalance).toBe('CREDIT');
    expect(() => svc.createAccount({
      businessId: 'business-7',
      code: '5100',
      name: 'Expense with bad balance',
      accountType: 'EXPENSE',
      normalBalance: 'CREDIT',
      isActive: true,
    })).toThrow('normal balance');
  });

  it('supports inactivating a non-system account without deleting it', () => {
    const engine = new AccountingEngine({
      businessId: 'business-8',
      accounts: [{ id: 'asset-root', businessId: 'business-8', code: '1000', name: 'Assets', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: true, isActive: true }],
    });

    const svc = new ChartOfAccountsService(engine);
    const created = svc.createAccount({
      businessId: 'business-8',
      code: '1100',
      name: 'Cash',
      accountType: 'ASSET',
      parentId: 'asset-root',
      normalBalance: 'DEBIT',
      isActive: true,
    });

    const updated = svc.updateAccount({
      businessId: 'business-8',
      id: created.id,
      isActive: false,
    });

    expect(updated.isActive).toBe(false);
    expect(svc.listAccounts('business-8')).toHaveLength(2);
  });

  it('protects system accounts from unsafe mutation', () => {
    const engine = new AccountingEngine({
      businessId: 'business-9',
      accounts: [{ id: 'asset-root', businessId: 'business-9', code: '1000', name: 'Assets', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: true, isActive: true }],
    });

    const svc = new ChartOfAccountsService(engine);
    expect(() => svc.updateAccount({
      businessId: 'business-9',
      id: 'asset-root',
      name: 'Changed',
    })).toThrow('protected');
  });

  it('enforces business isolation', () => {
    const engine = new AccountingEngine({
      businessId: 'business-10',
      accounts: [{ id: 'asset-root', businessId: 'business-10', code: '1000', name: 'Assets', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: true, isActive: true }],
    });

    const svc = new ChartOfAccountsService(engine);
    expect(() => svc.listAccounts('other-business')).toThrow('Business');
    expect(() => svc.createAccount({
      businessId: 'other-business',
      code: '1100',
      name: 'Cash',
      accountType: 'ASSET',
      normalBalance: 'DEBIT',
      isActive: true,
    })).toThrow('Business');
  });

  it('blocks modifying accounts used by posted journals', () => {
    const engine = new AccountingEngine({
      businessId: 'business-11',
      accounts: [
        { id: 'asset-root', businessId: 'business-11', code: '1000', name: 'Assets', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: true, isActive: true },
        { id: 'cash', businessId: 'business-11', code: '1100', name: 'Cash', accountType: 'ASSET', normalBalance: 'DEBIT', parentId: 'asset-root', isSystem: false, isActive: true },
      ],
    });

    const svc = new ChartOfAccountsService(engine);
    const created = svc.createAccount({
      businessId: 'business-11',
      code: '3000',
      name: 'Capital',
      accountType: 'EQUITY',
      normalBalance: 'CREDIT',
      isActive: true,
    });

    const journal = engine.createJournal({
      businessId: 'business-11',
      journalNo: 'J-COA-1',
      journalDate: '2026-09-15',
      sourceType: 'MANUAL',
      lines: [
        { accountId: 'cash', debit: '100.00', description: 'Cash inflow' },
        { accountId: created.id, credit: '100.00', description: 'Capital' },
      ],
    });
    engine.postJournal(journal, { postedBy: 'tester', idempotencyKey: 'coa-journal' });

    expect(() => svc.updateAccount({ businessId: 'business-11', id: 'cash', name: 'Banked cash' })).toThrow('posted journals');
  });

  it('rejects parent relationships that cross account types', () => {
    const engine = new AccountingEngine({
      businessId: 'business-12',
      accounts: [
        { id: 'asset-root', businessId: 'business-12', code: '1000', name: 'Assets', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: true, isActive: true },
        { id: 'revenue-root', businessId: 'business-12', code: '4000', name: 'Revenue', accountType: 'REVENUE', normalBalance: 'CREDIT', isSystem: true, isActive: true },
      ],
    });

    const svc = new ChartOfAccountsService(engine);
    expect(() => svc.createAccount({
      businessId: 'business-12',
      code: '1100',
      name: 'Cash',
      accountType: 'ASSET',
      parentId: 'revenue-root',
      normalBalance: 'DEBIT',
      isActive: true,
    })).toThrow('Parent relationship');
  });

  it('prevents circular parent chains during updates', () => {
    const engine = new AccountingEngine({
      businessId: 'business-13',
      accounts: [
        { id: 'root', businessId: 'business-13', code: '1000', name: 'Root Assets', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: false, isActive: true },
        { id: 'cash', businessId: 'business-13', code: '1100', name: 'Cash', accountType: 'ASSET', normalBalance: 'DEBIT', parentId: 'root', isSystem: false, isActive: true },
      ],
    });

    const svc = new ChartOfAccountsService(engine);
    expect(() => svc.updateAccount({
      businessId: 'business-13',
      id: 'root',
      parentId: 'cash',
    })).toThrow('Circular');
  });
});
