import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = join(process.cwd(), 'supabase/migrations/019_default_coa_and_atomic_bank_accounts.sql');

describe('default chart and automatic bank ledger migration', () => {
  it('backfills and provisions tenant-scoped COA defaults without replacing existing codes', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('public.ensure_default_coa');
    expect(migration).toContain('on conflict (business_id, code) do nothing');
    expect(migration).toContain('after insert on public.businesses');
    expect(migration).toContain('for v_business_id in select b.id from public.businesses');
    expect(migration).toContain("'1000', 'Assets', 'ASSET'");
    expect(migration).toContain("'2000', 'Liabilities', 'LIABILITY'");
    expect(migration).toContain("'3000', 'Equity', 'EQUITY'");
    expect(migration).toContain("'4000', 'Revenue', 'REVENUE'");
    expect(migration).toContain("'5000', 'Expenses', 'EXPENSE'");
  });

  it('creates bank accounts and their asset ledgers atomically with tenant and retry guards', () => {
    const migration = readFileSync(migrationPath, 'utf8');
    const createRpc = migration.match(/function public\.create_financial_account_with_ledger\([\s\S]*?\n\$\$;/i)?.[0] ?? '';

    expect(createRpc).toContain('is_business_owner_or_admin(p_business_id)');
    expect(createRpc).toContain('pg_advisory_xact_lock');
    expect(createRpc).toContain('public.ensure_default_coa(p_business_id)');
    expect(createRpc).toContain('v_candidate in 1100..1999');
    expect(createRpc).toContain('public.post_accounting_transaction_atomic');
    expect(createRpc).toContain("'financialAccount', to_jsonb(v_financial_account)");
    expect(migration).toContain('Bank ledger is already linked to another bank account.');
    expect(migration).toContain('a.business_id = new.business_id');
    expect(migration).toContain('deferrable initially deferred');
    expect(migration).toContain('Opening balance requires a balanced posted journal entry.');
    expect(migration).not.toMatch(/drop\s+table|delete\s+from\s+public\.(accounts|financial_accounts)/i);
  });
});
