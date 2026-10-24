import { describe, expect, it } from 'vitest';

import { isLaunchTicketFragment } from '../lib/auth/launch-ticket';

describe('MYOPS launch ticket format', () => {
  it('accepts a 32-byte base64url ticket', () => {
    expect(isLaunchTicketFragment('#t=' + 'A'.repeat(43))).toBe(true);
  });
  it('rejects query-style and malformed fragments', () => {
    expect(isLaunchTicketFragment('#t=')).toBe(false);
    expect(isLaunchTicketFragment('#ticket=' + 'A'.repeat(43))).toBe(false);
    expect(isLaunchTicketFragment('#t=' + 'A'.repeat(42))).toBe(false);
  });
});
