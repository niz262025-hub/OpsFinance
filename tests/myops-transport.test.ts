// @vitest-environment node
import { generateKeyPairSync, createHash, verify } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canonicalJson, checkMyopsEntitlement, redeemMyopsTicket, requestMyops, signMyopsRequest } from '../lib/auth/myops-transport';

const pair = generateKeyPairSync('ed25519');
const config = { origin: 'https://myops.example', appId: 'opsfinance', keyVersion: 'current' as const,
  privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
afterEach(()=>vi.unstubAllEnvs());

describe('MYOPS signed server transport', () => {
  it('limits temporary preview access to the configured portal and refuses production forwarding',async()=>{
    const transport=vi.fn().mockResolvedValue({ok:true,json:async()=>({})});
    vi.stubEnv('MYOPS_STAGING_SHARE_TOKEN','s'.repeat(32));vi.stubEnv('MYOPS_ORIGIN',config.origin);vi.stubEnv('VERCEL_ENV','preview');
    await requestMyops(config,'redeem',{},transport);
    expect(new URL(transport.mock.calls.at(-1)![0]).searchParams.get('_vercel_share')).toBe('s'.repeat(32));
    vi.stubEnv('VERCEL_ENV','production');await requestMyops(config,'redeem',{},transport);
    expect(new URL(transport.mock.calls.at(-1)![0]).search).toBe('');
    vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('MYOPS_ORIGIN','https://other.example');await requestMyops(config,'redeem',{},transport);
    expect(new URL(transport.mock.calls.at(-1)![0]).search).toBe('');
  });
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


describe('MYOPS response boundaries', () => {
  const grant = { session_id: 'c08f2182-2a66-4fc9-bbe6-02a21da4d759', user_ref: 'x'.repeat(43),
    product: 'opsfinance', idle_seconds: 900, max_session_seconds: 43200 };
  const response = (data: unknown) => vi.fn().mockResolvedValue({ ok: true, json: async () => data });
  it('rejects malformed tickets before network access', async () => {
    const transport = response(grant);
    await expect(redeemMyopsTicket(config, 'invalid', transport)).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
  it('validates audience, identity and lifetime bounds', async () => {
    await expect(redeemMyopsTicket(config, 't'.repeat(43), response(grant))).resolves.toEqual(grant);
    for (const override of [{ product: 'opsflow' }, { session_id: 'bad' }, { user_ref: 'email@example.test' },
      { idle_seconds: 901 }, { max_session_seconds: 43201 }, { idle_seconds: 0 }]) {
      await expect(redeemMyopsTicket(config, 't'.repeat(43), response({ ...grant, ...override }))).rejects.toThrow('Invalid MYOPS grant.');
    }
  });
  it('denies expired, revoked, missing and nonboolean entitlement responses', async () => {
    for (const data of [null, {}, { entitled: true }, { entitled: 'true', session_active: true },
      { entitled: true, session_active: false }]) {
      await expect(checkMyopsEntitlement(config, grant.session_id, false, response(data))).rejects.toThrow();
    }
    const transport = response({ entitled: true, session_active: true });
    await expect(checkMyopsEntitlement(config, grant.session_id, false, transport)).resolves.toBeUndefined();
    expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual({ session_id: grant.session_id, product: 'opsfinance', activity: false });
  });
});
