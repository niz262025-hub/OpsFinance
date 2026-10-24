import { createHash, generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { canonicalMyopsRequest, redeemMyopsTicket, verifyMyopsAppSession } from '../lib/auth/myops-app-client';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

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

describe('MYOPS app-session validation', () => {
  it('sends a signed, uncached entitlement check for the configured app session', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    vi.stubEnv('MYOPS_APP_API_ORIGIN', 'https://myops.example');
    vi.stubEnv('MYOPS_APP_ID', 'opsfinance');
    vi.stubEnv('MYOPS_APP_PRIVATE_KEY_CURRENT', privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
    vi.stubEnv('MYOPS_KEY_VERSION', 'current');

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ entitled: true, session_active: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const sessionId = '8dcf91a8-15e3-4322-96e8-c195c15ed673';
    expect(await verifyMyopsAppSession(sessionId, true, true)).toBe(true);

    const [url, request] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.href).toBe('https://myops.example/api/app/entitlement');
    expect(request.cache).toBe('no-store');
    expect(JSON.parse(String(request.body))).toEqual({
      session_id: sessionId,
      product: 'opsfinance',
      activity: true,
      sensitive: true,
    });
    const headers = request.headers as Record<string, string>;
    const nonce = headers['x-myops-nonce'];
    const timestamp = headers['x-myops-timestamp'];
    const message = canonicalMyopsRequest(
      '/api/app/entitlement',
      'opsfinance',
      'current',
      timestamp,
      nonce,
      { session_id: sessionId, product: 'opsfinance', activity: true, sensitive: true },
    );
    expect(verify(null, Buffer.from(message), publicKey, Buffer.from(headers['x-myops-signature'], 'base64url'))).toBe(true);
  });

  it('fails closed when MYOPS says the session or entitlement is inactive', async () => {
    const { privateKey } = generateKeyPairSync('ed25519');
    vi.stubEnv('MYOPS_APP_API_ORIGIN', 'https://myops.example');
    vi.stubEnv('MYOPS_APP_ID', 'opsfinance');
    vi.stubEnv('MYOPS_APP_PRIVATE_KEY', privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ entitled: true, session_active: false }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    expect(await verifyMyopsAppSession('8dcf91a8-15e3-4322-96e8-c195c15ed673', true)).toBe(false);
  });

  it('fails closed on an MYOPS outage and rejects malformed session IDs', async () => {
    const { privateKey } = generateKeyPairSync('ed25519');
    vi.stubEnv('MYOPS_APP_API_ORIGIN', 'https://myops.example');
    vi.stubEnv('MYOPS_APP_ID', 'opsfinance');
    vi.stubEnv('MYOPS_APP_PRIVATE_KEY', privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);
    expect(await verifyMyopsAppSession('8dcf91a8-15e3-4322-96e8-c195c15ed673', true)).toBe(false);
    expect(await verifyMyopsAppSession('invalid', true)).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
