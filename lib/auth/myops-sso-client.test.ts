import { createHash, generateKeyPairSync, verify } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canonicalJson, canonicalRequest, checkMyopsEntitlement, redeemMyopsTicket } from './myops-sso-client';

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe('MYOPS signed server client', () => {
  it('canonicalizes nested JSON independently of insertion order', () => {
    expect(canonicalJson({ b: { z: 3, a: [true, null] }, a: 1 }))
      .toBe(canonicalJson({ a: 1, b: { a: [true, null], z: 3 } }));
    expect(canonicalRequest('redeem', 'opsfinance', 'current', '123', 'abc', { ticket: 'x' }))
      .toBe(`POST\n/api/app/redeem\nopsfinance\ncurrent\n123\nabc\n${createHash('sha256').update('{"ticket":"x"}').digest('hex')}`);
  });

  it('signs the exact request MYOPS verifies and checks the response', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    process.env.MYOPS_SSO_BASE_URL = 'https://myops-staging.example.com';
    process.env.MYOPS_SSO_APP_ID = 'opsfinance';
    process.env.MYOPS_SSO_ED25519_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    process.env.MYOPS_SSO_KEY_VERSION = 'current';
    const ticket = 'a'.repeat(43);
    const session_id = '123e4567-e89b-42d3-a456-426614174000';
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('https://myops-staging.example.com/api/app/redeem');
      expect(init.redirect).toBe('error');
      const headers = init.headers as Record<string, string>;
      const body = JSON.parse(String(init.body));
      expect(body).toEqual({ ticket });
      const canonical = canonicalRequest('redeem', headers['x-myops-app-id'],
        headers['x-myops-key-version'], headers['x-myops-timestamp'], headers['x-myops-nonce'], body);
      expect(verify(null, Buffer.from(canonical), publicKey, Buffer.from(headers['x-myops-signature'], 'base64url'))).toBe(true);
      return { ok: true, json: async () => ({
        session_id, user_ref: 'b'.repeat(43), product: 'opsfinance', idle_seconds: 900, max_session_seconds: 43200,
      }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    expect((await redeemMyopsTicket(ticket)).session_id).toBe(session_id);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed launch tickets before any network request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(redeemMyopsTicket('not-a-ticket')).rejects.toThrow('Invalid MYOPS launch ticket');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed for malformed session identifiers', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await checkMyopsEntitlement('bad')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an insecure MYOPS origin', async () => {
    const { privateKey } = generateKeyPairSync('ed25519');
    process.env.MYOPS_SSO_BASE_URL = 'http://untrusted.example.com';
    process.env.MYOPS_SSO_APP_ID = 'opsfinance';
    process.env.MYOPS_SSO_ED25519_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    await expect(redeemMyopsTicket('a'.repeat(43))).rejects.toThrow('Invalid MYOPS SSO origin');
  });
});
