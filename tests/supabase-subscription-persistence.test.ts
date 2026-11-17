import { describe, expect, it } from 'vitest';

import { SupabaseBusinessRepository, SupabaseSubscriptionRepository } from '../packages/supabase-persistence';

describe('supabase subscription persistence', () => {
  it('creates a business subscription with trial timestamps persisted in Supabase', async () => {
    const tables: Record<string, any[]> = {
      businesses: [],
      business_members: [],
      subscriptions: [],
    };

    const client: any = {
      from: (table: string) => ({
        insert: (payload: any) => ({
          select: () => ({
            single: async () => {
              const row = Array.isArray(payload) ? payload[0] : payload;
              const nextRow = { ...row };
              if (!nextRow.id && table === 'businesses') {
                nextRow.id = `business-${tables.businesses.length + 1}`;
              }
              if (!nextRow.id && table === 'subscriptions') {
                nextRow.id = `sub-${tables.subscriptions.length + 1}`;
              }
              tables[table].push(nextRow);
              return { data: nextRow, error: null };
            },
          }),
        }),
        upsert: (payload: any) => ({
          select: () => ({
            single: async () => {
              const row = Array.isArray(payload) ? payload[0] : payload;
              const current = tables[table] ?? [];
              const existingIndex = current.findIndex((entry) => {
                if (table === 'business_members') {
                  return entry.business_id === row.business_id && entry.user_id === row.user_id;
                }
                if (table === 'subscriptions') {
                  return entry.business_id === row.business_id;
                }
                return false;
              });

              if (existingIndex >= 0) {
                current[existingIndex] = row;
              } else {
                current.push(row);
              }
              tables[table] = current;
              return { data: row, error: null };
            },
          }),
        }),
        select: () => ({
          eq: (key: string, value: string) => ({
            maybeSingle: async () => {
              const rows = tables[table] ?? [];
              const match = rows.find((row) => row[key] === value) ?? rows[0] ?? null;
              return { data: match, error: null };
            },
          }),
        }),
      }),
    };

    const businessRepo = new SupabaseBusinessRepository(client as any);
    const created = await businessRepo.create('user-123', {
      name: 'Demo Business',
      baseCurrency: 'MYR',
      email: 'owner@example.com',
    });

    expect(created.name).toBe('Demo Business');
    expect(tables.business_members).toHaveLength(1);
    expect(tables.subscriptions).toHaveLength(1);
    expect(tables.subscriptions[0].status).toBe('TRIAL');
    expect(tables.subscriptions[0].trial_started_at).toBeTruthy();
    expect(tables.subscriptions[0].trial_ends_at).toBeTruthy();

    const subscriptionRepo = new SupabaseSubscriptionRepository(client as any);
    const persisted = await subscriptionRepo.getByBusiness(created.id);
    expect(persisted.business_id).toBe(created.id);
    expect(persisted.status).toBe('TRIAL');
  });

  it('resolves a parent account by code before creating a business-scoped child account', async () => {
    const tables: Record<string, any[]> = {
      accounts: [
        { id: 'asset-root', business_id: 'business-1', code: '1000', name: 'Assets', account_type: 'ASSET', parent_id: null, normal_balance: 'DEBIT', is_system: true, is_active: true },
      ],
    };

    const client: any = {
      from: (table: string) => ({
        select: () => ({
          eq: (key: string, value: string) => ({
            maybeSingle: async () => {
              const rows = tables[table] ?? [];
              const match = rows.find((row) => {
                if (key === 'id') return row.id === value;
                if (key === 'business_id') return row.business_id === value;
                if (key === 'code') return row.code === value;
                return row[key] === value;
              }) ?? null;
              return { data: match, error: null };
            },
            eq: (nextKey: string, nextValue: string) => ({
              maybeSingle: async () => {
                const rows = tables[table] ?? [];
                const match = rows.find((row) => {
                  if (nextKey === 'id') return row.id === nextValue;
                  if (nextKey === 'business_id') return row.business_id === nextValue;
                  if (nextKey === 'code') return row.code === nextValue;
                  return row[nextKey] === nextValue;
                }) ?? null;
                return { data: match, error: null };
              },
            }),
          }),
        }),
        upsert: (payload: any) => ({
          select: () => ({
            single: async () => {
              const row = Array.isArray(payload) ? payload[0] : payload;
              const current = tables[table] ?? [];
              const existingIndex = current.findIndex((entry) => entry.business_id === row.business_id && entry.code === row.code);
              if (existingIndex >= 0) {
                current[existingIndex] = { ...current[existingIndex], ...row, id: current[existingIndex].id };
              } else {
                row.id ??= `account-${current.length + 1}`;
                current.push(row);
              }
              tables[table] = current;
              return { data: row, error: null };
            },
          }),
        }),
      }),
    };

    const { SupabaseAccountRepository } = await import('../packages/supabase-persistence');
    const repo = new SupabaseAccountRepository(client as any);
    const created = await repo.upsertByCode('business-1', {
      code: '1100',
      name: 'Cash',
      account_type: 'ASSET',
      normal_balance: 'DEBIT',
      is_system: true,
      is_active: true,
      parentCode: '1000',
    });

    expect(created.parent_id).toBe('asset-root');
    expect(tables.accounts).toContainEqual(expect.objectContaining({ code: '1100', parent_id: 'asset-root' }));
  });
});
