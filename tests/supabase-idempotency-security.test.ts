import { describe, expect, it, vi } from 'vitest';
import { SupabaseIdempotencyRepository } from '../packages/supabase-persistence';

describe('legacy direct idempotency paths remain disabled', () => {
  it('requires atomic posting instead of querying or reserving client rows', async () => {
    const from = vi.fn(() => { throw new Error('Unexpected database access'); });
    const repo = new SupabaseIdempotencyRepository({ from } as any);
    await expect(repo.get('business-a', 'key')).rejects.toThrow(/Direct idempotency lookup is disabled/);
    await expect(repo.reserve('business-a', 'key', 'result')).rejects.toThrow(/Direct idempotency reservation is disabled/);
    expect(from).not.toHaveBeenCalled();
  });
});
