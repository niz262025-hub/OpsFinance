import { describe, expect, it, vi } from 'vitest';
import { SupabaseRepositoryAdapter, SupabaseTransactionRepository } from '../packages/supabase-persistence';

describe('tenant write boundaries', () => {
  it('rejects unscoped updates before hitting Supabase', async () => {
    const from = vi.fn();
    const repo = new SupabaseRepositoryAdapter<any>('accounts', { from });
    await expect(repo.update('record-1', { name: 'changed' })).rejects.toThrow('Business access denied');
    expect(from).not.toHaveBeenCalled();
  });

  it('blocks ownership and record id changes', async () => {
    const repo = new SupabaseRepositoryAdapter<any>('accounts', { from: vi.fn() });
    await expect(repo.update('record-1', { business_id: 'other' }, 'business-a')).rejects.toThrow('ownership');
    await expect(repo.update('record-1', { id: 'record-2' }, 'business-a')).rejects.toThrow('identity');
  });

  it('adds both id and business_id predicates for updates', async () => {
    const filters: Array<[string, string]> = [];
    const query: any = {
      eq: vi.fn((key: string, value: string) => { filters.push([key, value]); return query; }),
      select: vi.fn(async () => ({ data: [{ id: 'record-1', business_id: 'business-a', name: 'changed' }], error: null })),
    };
    const repo = new SupabaseRepositoryAdapter<any>('accounts', { from: () => ({ update: () => query }) });
    await repo.update('record-1', { name: 'changed' }, 'business-a');
    expect(filters).toEqual([['id', 'record-1'], ['business_id', 'business-a']]);
  });

  it('rejects cross-business updates when no row matches', async () => {
    const query: any = { eq: vi.fn(() => query), select: vi.fn(async () => ({ data: [], error: null })) };
    const repo = new SupabaseRepositoryAdapter<any>('accounts', { from: () => ({ update: () => query }) });
    await expect(repo.update('record-1', { name: 'changed' }, 'business-a')).rejects.toThrow('Record not found');
  });

  it('inserts transactions without upsert and verifies business ownership', async () => {
    const insert = vi.fn(() => ({ select: () => ({ single: async () => ({
      data: { id: 'tx-1', business_id: 'business-a' }, error: null,
    }) }) }));
    const upsert = vi.fn();
    const repo = new SupabaseTransactionRepository({ from: () => ({ insert, upsert }) });
    await repo.create({ id: 'tx-1', businessId: 'business-a', date: '2026-10-19', type: 'MONEY_IN', amount: '10.00', description: 'test' } as any);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('journal insert identity protection', () => {
  it('rejects an empty journal business before any database operation', async () => {
    const { SupabaseJournalRepository } = await import('../packages/supabase-persistence');
    const from = vi.fn();
    const repo = new SupabaseJournalRepository({ from });
    await expect(repo.createPosted({ businessId: '', lines: [] } as any)).rejects.toThrow('Business access denied');
    expect(from).not.toHaveBeenCalled();
  });

  it('does not overwrite an existing journal or insert lines when the journal insert fails', async () => {
    const { SupabaseJournalRepository } = await import('../packages/supabase-persistence');
    const insert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'duplicate key' } }) }) }));
    const upsert = vi.fn();
    const from = vi.fn(() => ({ insert, upsert }));
    const repo = new SupabaseJournalRepository({ from });
    await expect(repo.createPosted({ id: 'existing', businessId: 'business-a', journalDate: '2026-10-26', lines: [{ accountId: 'cash', debit: '10.00' }, { accountId: 'sales', credit: '10.00' }] } as any)).rejects.toThrow('duplicate key');
    expect(upsert).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('journal_entries');
  });
});


describe('transaction create rejection', () => {
  const transaction = { id: 'existing', businessId: 'business-a', date: '2026-10-26', type: 'MONEY_IN', amount: '10.00', description: 'test' } as any;
  it('rejects missing scope before any request', async () => {
    const from = vi.fn();
    await expect(new SupabaseTransactionRepository({ from }).create({ ...transaction, businessId: '' })).rejects.toThrow('Business access denied');
    expect(from).not.toHaveBeenCalled();
  });
  it('propagates duplicate rejection instead of overwriting an existing transaction', async () => {
    const upsert = vi.fn();
    const repo = new SupabaseTransactionRepository({ from: () => ({ upsert, insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'duplicate key' } }) }) }) }) });
    await expect(repo.create(transaction)).rejects.toThrow('duplicate key');
    expect(upsert).not.toHaveBeenCalled();
  });
  it('rejects an unexpected tenant in the database response', async () => {
    const repo = new SupabaseTransactionRepository({ from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { business_id: 'business-b' }, error: null }) }) }) }) });
    await expect(repo.create(transaction)).rejects.toThrow('Business access denied');
  });
});
