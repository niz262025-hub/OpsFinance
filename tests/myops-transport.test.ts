// @vitest-environment node
import { generateKeyPairSync, createHash, verify } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { canonicalJson, requestMyops, signMyopsRequest } from '../lib/auth/myops-transport';

const pair = generateKeyPairSync('ed25519');
const config = { origin: 'https://myops.example', appId: 'opsfinance', keyVersion: 'current' as const,
  privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };

describe('MYOPS signed server transport', () => {
  it('matches the MYOPS canonical request and verifies with the registered public key', () => {
    const body = { ticket: 'a'.repeat(43) };
    const result = signMyopsRequest(config, 'redeem', body, '1793000000000', 'n'.repeat(32));
    const digest = createHash('sha256').update('{"ticket":"' + 'a'.repeat(43) + '"}').digest('hex');
    const message = `POST\n/api/app/redeem\nopsfinance\ncurrent\n1793000000000\n${'n'.repeat(32)}\n${digest}`;
    expect(verify(null, Buffer.from(message), pair.publicKey, Buffer.from(result.headers['x-myops-signature'], 'base64url'))).toBe(true);
    expect(verify(null, Buffer.from(message.replace('redeem', 'entitlement')), pair.publicKey,
      Buffer.from(result.headers['x-myops-signature'], 'base64url'))).toBe(false);
  });
  it('sorts nested fields and rejects ambiguous unsigned values', () => {
    expect(canonicalJson({ z: { b: 1, a: 2 }, a: [true, null] })).toBe('{"a":[true,null],"z":{"a":2,"b":1}}');
    for (const value of [undefined, NaN, Infinity, new Date(), { x: undefined }]) expect(() => canonicalJson(value)).toThrow();
  });
  it('rejects unsafe origins and incorrect key types', () => {
    for (const origin of ['http://myops.example', 'https://user:pass@myops.example', 'https://myops.example/other', 'https://myops.example/?x=1']) {
      expect(() => signMyopsRequest({ ...config, origin }, 'redeem', {})).toThrow();
    }
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
    expect(() => signMyopsRequest({ ...config, privateKey: rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() }, 'redeem', {})).toThrow();
  });
  it('uses fresh nonces, refuses redirects and fails closed without leaking upstream errors', async () => {
    expect(signMyopsRequest(config, 'redeem', {}).headers['x-myops-nonce']).not.toBe(signMyopsRequest(config, 'redeem', {}).headers['x-myops-nonce']);
    const transport = vi.fn().mockResolvedValue({ ok: false });
    await expect(requestMyops(config, 'entitlement', {}, transport)).rejects.toThrow('MYOPS access could not be verified.');
    expect(transport.mock.calls[0][1]).toMatchObject({ redirect: 'error', cache: 'no-store' });
  });
});
