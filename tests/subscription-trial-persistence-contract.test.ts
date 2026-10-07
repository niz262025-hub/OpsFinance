import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('subscription trial persistence contract', () => {
  it('adds nullable trial timestamps to the production subscriptions table without duplicating the table', () => {
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/008_subscription_trial_timestamps.sql'), 'utf8');

    expect(migration).toContain('alter table public.subscriptions');
    expect(migration).toContain('trial_started_at');
    expect(migration).toContain('trial_ends_at');
    expect(migration).toContain('add column if not exists');
    expect(migration).not.toContain('create table public.subscriptions');
    expect(migration).toContain('idx_subscriptions_trial_ends_at');
  });
});
