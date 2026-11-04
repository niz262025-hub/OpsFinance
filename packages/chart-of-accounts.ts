import { AccountingEngine, type AccountType, type BusinessAccount, type NormalBalance } from './accounting';

export type CoaAccountStatus = 'ACTIVE' | 'INACTIVE';

export interface ChartOfAccountsAccount extends BusinessAccount {
  parentName?: string | null;
  status: CoaAccountStatus;
  children?: ChartOfAccountsAccount[];
}

export interface CreateChartAccountInput {
  businessId: string;
  code: string;
  name: string;
  accountType: AccountType;
  parentId?: string | null;
  normalBalance?: NormalBalance;
  isActive?: boolean;
  isSystem?: boolean;
}

export interface UpdateChartAccountInput {
  businessId: string;
  id: string;
  code?: string;
  name?: string;
  accountType?: AccountType;
  parentId?: string | null;
  normalBalance?: NormalBalance;
  isActive?: boolean;
}

const ALLOWED_ACCOUNT_TYPES: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COGS', 'EXPENSE'];

export class ChartOfAccountsService {
  private readonly engine: AccountingEngine;

  constructor(engine: AccountingEngine) {
    this.engine = engine;
  }

  private getBusinessAccounts(businessId: string): BusinessAccount[] {
    const accounts = [...((this.engine as any).accounts as Map<string, BusinessAccount>).values()];
    return accounts.filter((account) => account.businessId === businessId);
  }

  private authorizeBusiness(businessId: string): void {
    this.engine.authorizeBusiness(businessId, this.engine.businessId);
  }

  private validateParentRelationship(businessId: string, accountType: AccountType, parentId?: string | null, currentId?: string | null): void {
    if (!parentId) {
      return;
    }

    const parent = this.getBusinessAccounts(businessId).find((entry) => entry.id === parentId);
    if (!parent) {
      throw new Error('Parent account does not exist.');
    }

    if (parent.businessId !== businessId) {
      throw new Error('Parent account does not belong to this business.');
    }

    if (currentId && parentId === currentId) {
      throw new Error('Circular parent reference detected.');
    }

    if (parent.accountType !== accountType) {
      throw new Error('Parent relationship is invalid for this account type.');
    }

    if (currentId) {
      let cursor: string | null = parentId;
      const seen = new Set<string>();
      while (cursor) {
        if (seen.has(cursor)) {
          break;
        }
        seen.add(cursor);
        if (cursor === currentId) {
          throw new Error('Circular parent reference detected.');
        }
        const ancestor = this.getBusinessAccounts(businessId).find((entry) => entry.id === cursor);
        cursor = ancestor?.parentId ?? null;
      }
    }
  }

  private hasPostedJournalActivity(businessId: string, accountId: string): boolean {
    const journals = [...((this.engine as any).journals as Map<string, any>).values()];
    return journals.some(
      (journal) => journal.businessId === businessId && journal.status === 'POSTED' && journal.lines.some((line: any) => line.accountId === accountId),
    );
  }

  private buildNormalBalance(accountType: AccountType): NormalBalance {
    switch (accountType) {
      case 'ASSET':
      case 'EXPENSE':
      case 'COGS':
        return 'DEBIT';
      case 'LIABILITY':
      case 'EQUITY':
      case 'REVENUE':
        return 'CREDIT';
      default:
        throw new Error('Invalid account type.');
    }
  }

  listAccounts(businessId: string): BusinessAccount[] {
    this.authorizeBusiness(businessId);
    return this.getBusinessAccounts(businessId).sort((a, b) => a.code.localeCompare(b.code));
  }

  getHierarchy(businessId: string): Array<ChartOfAccountsAccount & { children: ChartOfAccountsAccount[] }> {
    this.authorizeBusiness(businessId);
    const accounts = this.getBusinessAccounts(businessId);
    const lookup = new Map<string, ChartOfAccountsAccount & { children: ChartOfAccountsAccount[]; parentName: string | null; status: CoaAccountStatus }>();

    for (const account of accounts) {
      const normalized: ChartOfAccountsAccount & { children: ChartOfAccountsAccount[]; parentName: string | null; status: CoaAccountStatus } = {
        ...account,
        children: [],
        parentName: null,
        status: account.isActive === false ? 'INACTIVE' : 'ACTIVE',
      };
      lookup.set(account.id, normalized);
    }

    for (const account of lookup.values()) {
      const parent = account.parentId ? lookup.get(account.parentId) : null;
      if (parent) {
        parent.children.push(account);
        account.parentName = parent.name;
      }
    }

    return [...lookup.values()]
      .filter((account) => !account.parentId)
      .map((account) => ({
        ...account,
        children: account.children,
      }));
  }

  createAccount(input: CreateChartAccountInput): BusinessAccount {
    this.authorizeBusiness(input.businessId);

    if (!ALLOWED_ACCOUNT_TYPES.includes(input.accountType)) {
      throw new Error('Invalid account type.');
    }

    const accountCode = input.code.trim();
    if (!accountCode) {
      throw new Error('Account code is required.');
    }

    if (!input.name?.trim()) {
      throw new Error('Account name is required.');
    }

    const existing = this.getBusinessAccounts(input.businessId).find((account) => account.code === accountCode);
    if (existing) {
      throw new Error(`Account code ${accountCode} already exists.`);
    }

    this.validateParentRelationship(input.businessId, input.accountType, input.parentId ?? null, null);

    const normalBalance = input.normalBalance ?? this.buildNormalBalance(input.accountType);
    const validBalance = input.accountType === 'ASSET'
      ? normalBalance === 'DEBIT' || normalBalance === 'CREDIT'
      : input.accountType === 'EXPENSE' || input.accountType === 'COGS'
      ? normalBalance === 'DEBIT'
      : normalBalance === 'CREDIT';
    if (!validBalance) {
      throw new Error('normal balance is invalid for this account type.');
    }

    const created: BusinessAccount = {
      id: `coa-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      businessId: input.businessId,
      code: accountCode,
      name: input.name.trim(),
      accountType: input.accountType,
      normalBalance,
      parentId: input.parentId ?? null,
      isSystem: input.isSystem ?? false,
      isActive: input.isActive ?? true,
    };

    const registry = (this.engine as any).accounts as Map<string, BusinessAccount>;
    registry.set(created.id, created);
    return created;
  }

  updateAccount(input: UpdateChartAccountInput): BusinessAccount {
    this.authorizeBusiness(input.businessId);
    const target = this.getBusinessAccounts(input.businessId).find((account) => account.id === input.id);
    if (!target) {
      throw new Error('Account not found.');
    }

    if (target.isSystem && (input.name !== undefined || input.code !== undefined || input.accountType !== undefined || input.parentId !== undefined || input.normalBalance !== undefined)) {
      throw new Error('System accounts are protected from unsafe modification.');
    }

    if (this.hasPostedJournalActivity(input.businessId, input.id)) {
      if (input.name !== undefined || input.code !== undefined || input.accountType !== undefined || input.parentId !== undefined || input.normalBalance !== undefined) {
        throw new Error('Account cannot be modified because posted journals already use it.');
      }
    }

    const nextCode = input.code?.trim() ?? target.code;
    const nextName = input.name?.trim() ?? target.name;
    const nextType = input.accountType ?? target.accountType;
    const nextParentId = input.parentId ?? target.parentId ?? null;
    const nextNormalBalance = input.normalBalance ?? target.normalBalance;

    if (nextCode !== target.code) {
      const dupe = this.getBusinessAccounts(input.businessId).find((account) => account.id !== input.id && account.code === nextCode);
      if (dupe) {
        throw new Error(`Account code ${nextCode} already exists.`);
      }
    }

    if (!ALLOWED_ACCOUNT_TYPES.includes(nextType)) {
      throw new Error('Invalid account type.');
    }

    if (nextParentId && nextParentId !== target.parentId) {
      this.validateParentRelationship(input.businessId, nextType, nextParentId, target.id);
    }

    if (nextParentId === target.id) {
      throw new Error('Circular parent reference detected.');
    }

    const isAssetLike = nextType === 'EXPENSE' || nextType === 'COGS';
    const validBalance = nextType === 'ASSET'
      ? nextNormalBalance === 'DEBIT' || nextNormalBalance === 'CREDIT'
      : isAssetLike ? nextNormalBalance === 'DEBIT' : nextNormalBalance === 'CREDIT';
    if (!validBalance) {
      throw new Error('normal balance is invalid for this account type.');
    }

    const updated: BusinessAccount = {
      ...target,
      code: nextCode,
      name: nextName,
      accountType: nextType,
      parentId: nextParentId,
      normalBalance: nextNormalBalance,
      isActive: input.isActive ?? target.isActive,
    };

    const registry = (this.engine as any).accounts as Map<string, BusinessAccount>;
    registry.set(updated.id, updated);
    return updated;
  }

  deactivateAccount(businessId: string, id: string): BusinessAccount {
    this.authorizeBusiness(businessId);
    return this.updateAccount({ businessId, id, isActive: false });
  }
}
