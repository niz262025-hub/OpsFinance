import { createHash, createPrivateKey, randomBytes, sign } from 'node:crypto';

// Node server only. Never import this module into a client component or Edge middleware.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value && Object.getPrototypeOf(value) === Object.prototype) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  throw new Error('Invalid MYOPS request body.');
}

export interface MyopsTransportConfig {
  origin: string;
  appId: string;
  privateKey: string;
  keyVersion: 'current' | 'next';
}

export function signMyopsRequest(config: MyopsTransportConfig, endpoint: 'redeem' | 'entitlement', body: unknown,
  timestamp = String(Date.now()), nonce = randomBytes(32).toString('base64url')) {
  if (typeof window !== 'undefined') throw new Error('MYOPS credentials are server-only.');
  const origin = new URL(config.origin);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash
      || !/^[a-z][a-z0-9_-]{1,31}$/.test(config.appId) || !['current', 'next'].includes(config.keyVersion)
      || !/^\d{13}$/.test(timestamp) || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) throw new Error('Invalid MYOPS configuration.');
  const key = createPrivateKey(config.privateKey);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('MYOPS requires an Ed25519 key.');
  const path = `/api/app/${endpoint}`;
  const payload = canonicalJson(body);
  const digest = createHash('sha256').update(payload).digest('hex');
  const message = `POST\n${path}\n${config.appId}\n${config.keyVersion}\n${timestamp}\n${nonce}\n${digest}`;
  return { url: `${origin.origin}${path}`, body: payload, headers: {
    'Content-Type': 'application/json',
    'x-myops-app-id': config.appId,
    'x-myops-key-version': config.keyVersion,
    'x-myops-timestamp': timestamp,
    'x-myops-nonce': nonce,
    'x-myops-signature': sign(null, Buffer.from(message), key).toString('base64url'),
  } };
}

export async function requestMyops(config: MyopsTransportConfig, endpoint: 'redeem' | 'entitlement', body: unknown,
  transport: typeof fetch = fetch): Promise<unknown> {
  const request = signMyopsRequest(config, endpoint, body);
  const response = await transport(request.url, { method: 'POST', headers: request.headers, body: request.body,
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000) });
  // Do not propagate upstream errors, credentials, tickets or response bodies into logs/UI.
  if (!response.ok) throw new Error('MYOPS access could not be verified.');
  return response.json();
}
