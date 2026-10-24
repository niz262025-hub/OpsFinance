import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalMyopsRequest } from '../lib/auth/myops-app-client';

describe('MYOPS signed request canonicalization', () => {
  it('uses newline separators and the SHA-256 hash of canonical JSON', () => {
    const body = { ticket: 'example' };
    const hash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    expect(canonicalMyopsRequest('/api/app/redeem', 'opsfinance', 'current', '123', 'nonce', body))
      .toBe(['POST', '/api/app/redeem', 'opsfinance', 'current', '123', 'nonce', hash].join('\\n'.replace('\\n', '\n')));
  });
});
