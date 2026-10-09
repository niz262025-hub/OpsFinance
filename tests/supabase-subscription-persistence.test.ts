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
});
