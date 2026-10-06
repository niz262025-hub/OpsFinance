import { describe, expect, it } from 'vitest';

import { resolveCurrentBusinessForUser } from '../lib/auth/business';

describe('source-of-truth guardrails', () => {
  it('requires an authorized business membership before resolving the active business', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({ data: [], error: null }),
        }),
      }),
    };

    const result = await resolveCurrentBusinessForUser(supabase as any, 'user-no-business');

    expect(result.business).toBeNull();
    expect(result.error).toContain('No authorized business');
  });

  it('does not allow fake fallback creation in the auth resolver', async () => {
    const resolverSource = await import('../lib/auth/business');
    const file = await import('node:fs/promises');
    const source = await file.readFile('./lib/auth/business.ts', 'utf8');

    expect(resolverSource.resolveCurrentBusinessForUser).toBeDefined();
    expect(source).not.toContain('create_business_with_owner');
    expect(source).not.toContain('OpsFinance UAT Business');
  });
});
