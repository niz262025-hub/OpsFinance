import { describe, expect, it } from 'vitest';

import { resolveAuthorizedBusinessId } from '../lib/auth/business';

describe('business context isolation', () => {
  it('accepts the active business only when the authenticated user belongs to it', () => {
    expect(resolveAuthorizedBusinessId('user-a', ['business-a', 'business-b'], 'business-b')).toBe('business-b');
  });

  it('rejects a business id that is not linked to the authenticated user', () => {
    expect(() => resolveAuthorizedBusinessId('user-a', ['business-a'], 'business-b')).toThrow('Business access denied.');
  });

  it('rejects empty or missing business context', () => {
    expect(() => resolveAuthorizedBusinessId('user-a', [], '')).toThrow('Business access denied.');
  });
});
