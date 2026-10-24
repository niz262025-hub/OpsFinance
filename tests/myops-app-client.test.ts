import { createHash } from 'node:crypto';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { canonicalMyopsRequest, redeemMyopsTicket } from '../lib/auth/myops-app-client';

afterEach(() => vi.unstubAllEnvs());

describe('MYOPS signed request canonicalization', () => {
  it('uses newline separators and the SHA-256 hash of canonical JSON', () => {
    const body = { ticket: 'example' };
    const hash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    expect(canonicalMyopsRequest('/api/app/redeem', 'opsfinance', 'current', '123', 'nonce', body))
      .toBe(['POST', '/api/app/redeem', 'opsfinance', 'current', '123', 'nonce', hash].join('\\n'.replace('\\n', '\n')));
  });
});


describe('MYOPS redemption fail-closed configuration', () => {
  it('rejects malformed launch tickets before calling MYOPS', async () => {
    await expect(redeemMyopsTicket('not-a-ticket')).rejects.toThrow('Invalid ticket');
  });
  it('rejects absent server signing configuration', async () => {
    vi.stubEnv('MYOPS_APP_API_ORIGIN', '');
    vi.stubEnv('MYOPS_APP_ID', '');
    vi.stubEnv('MYOPS_APP_PRIVATE_KEY', '');
    await expect(redeemMyopsTicket('a'.repeat(43))).rejects.toThrow('MYOPS SSO is not configured');
  });
  it('rejects non-HTTPS MYOPS origins', async () => {
    vi.stubEnv('MYOPS_APP_API_ORIGIN', 'http://localhost:3000');
    vi.stubEnv('MYOPS_APP_ID', 'opsfinance');
    vi.stubEnv('MYOPS_APP_PRIVATE_KEY', 'test-key');
    await expect(redeemMyopsTicket('a'.repeat(43))).rejects.toThrow('MYOPS SSO is not configured');
  });
});
