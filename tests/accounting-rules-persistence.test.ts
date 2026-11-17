import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SupabaseAccountingRuleRepository } from '../packages/supabase-persistence';

describe('accounting rules persistence contract', () => {
  it('adds the persisted contract required by the service model and blocks direct auto-post', () => {
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/020_accounting_rule_contract_alignment.sql'), 'utf8');

    expect(migration).toContain('add column if not exists match_type');
    expect(migration).toContain('add column if not exists match_value');
    expect(migration).toContain('add column if not exists suggested_account_id');
    expect(migration).toContain('add column if not exists suggested_financial_account_id');
    expect(migration).toContain('add column if not exists suggested_transaction_type');
    expect(migration).toContain('check (auto_post = false)');
    expect(migration).toContain('public.enforce_accounting_rule_business_scope');
    expect(migration).toContain('public.is_business_owner_or_admin(business_id)');
  });

  it('persists and reloads a rule without weakening the no-auto-post contract', async () => {
    const rows: any[] = [];
    const accounts = [{ id: 'coa-expense', business_id: 'business-a', is_active: true }];
    const financialAccounts = [{ id: 'fin-bank', business_id: 'business-a', status: 'ACTIVE' }];

    const client: any = {
      from: (table: string) => {
        if (table === 'accounts') {
          return {
            select: () => ({
              eq: (field: string, value: string) => ({
                eq: (_field: string, _value: string) => ({
                  maybeSingle: async () => {
                    const match = accounts.find((row) => row.id === value && row.business_id === _value);
                    return { data: match ?? null, error: null };
                  },
                }),
              }),
            }),
          };
        }

        if (table === 'financial_accounts') {
          return {
            select: () => ({
              eq: (field: string, value: string) => ({
                eq: (_field: string, _value: string) => ({
                  maybeSingle: async () => {
                    const match = financialAccounts.find((row) => row.id === value && row.business_id === _value);
                    return { data: match ?? null, error: null };
                  },
                }),
              }),
            }),
          };
        }

        if (table === 'accounting_rules') {
          return {
            insert: (payload: any) => ({
              select: () => ({
                single: async () => {
                  const row = {
                    ...payload,
                    id: payload.id ?? 'rule-1',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  };
                  rows.push(row);
                  return { data: row, error: null };
                },
              }),
            }),
            update: (payload: any) => ({
              eq: (field: string, value: string) => ({
                eq: (_field: string, _value: string) => ({
                  select: () => ({
                    single: async () => {
                      const row = rows.find((entry) => entry.id === value && entry.business_id === _value);
                      if (!row) {
                        return { data: null, error: { message: 'Row not found.' } };
                      }

                      Object.assign(row, payload);
                      row.updated_at = new Date().toISOString();
                      return { data: row, error: null };
                    },
                  }),
                }),
              }),
            }),
            select: () => ({
              eq: (field: string, value: string) => ({
                eq: (_field: string, _value: string) => ({
                  maybeSingle: async () => {
                    const row = rows.find((entry) => entry.id === value && entry.business_id === _value);
                    return { data: row ?? null, error: null };
                  },
                }),
              }),
            }),
          };
        }

        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        };
      },
    };

    const repo = new SupabaseAccountingRuleRepository(client);
    const created = await repo.createRule({
      businessId: 'business-a',
      userId: 'owner-user',
      name: 'Bank Charge',
      description: 'Bank charge for monthly operations',
      matchType: 'CONTAINS',
      matchValue: 'BANK CHARGE',
      suggestedAccountId: 'coa-expense',
      suggestedFinancialAccountId: 'fin-bank',
      suggestedTransactionType: 'EXPENSE',
      priority: 25,
      autoSuggest: true,
      autoPost: false,
    });

    expect(created.matchType).toBe('CONTAINS');
    expect(created.matchValue).toBe('BANK CHARGE');
    expect(created.autoPost).toBe(false);

    const reloaded = await repo.getRule('business-a', created.id);
    expect(reloaded.suggestedAccountId).toBe('coa-expense');
    expect(reloaded.suggestedFinancialAccountId).toBe('fin-bank');
    expect(reloaded.suggestedTransactionType).toBe('EXPENSE');

    const updated = await repo.updateRule('business-a', created.id, {
      priority: 50,
      isActive: false,
      autoSuggest: true,
    });

    expect(updated.priority).toBe(50);
    expect(updated.isActive).toBe(false);
  });
});
