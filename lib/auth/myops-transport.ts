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
  const url = new URL(request.url);
  // Owner-approved, expiring preview access only. Never send the bearer to another
  // origin or production, and never follow redirects carrying it.
  const previewShare = process.env.MYOPS_STAGING_SHARE_TOKEN;
  if (process.env.VERCEL_ENV === 'preview' && previewShare && config.origin === process.env.MYOPS_ORIGIN) {
    if (!/^[A-Za-z0-9_-]{16,256}$/.test(previewShare)) throw new Error('Invalid staging access configuration.');
    url.searchParams.set('_vercel_share', previewShare);
  }
  let response: Response;
  try {
    response = await transport(url.href, { method: 'POST', headers: request.headers, body: request.body,
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) });
  } catch (error) {
    if (process.env.VERCEL_ENV === 'preview') console.warn('myops_preview_transport_failed',
      error instanceof Error && ['TimeoutError','AbortError','TypeError'].includes(error.name) ? error.name : 'network');
    throw new Error('MYOPS access could not be verified.');
  }
  // Do not propagate upstream errors, credentials, tickets or response bodies into logs/UI.
  if (!response.ok) {
    if (process.env.VERCEL_ENV === 'preview') console.warn('myops_preview_transport_failed','http',response.status);
    throw new Error('MYOPS access could not be verified.');
  }
  return response.json();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface MyopsGrant {
  session_id: string;
  user_ref: string;
  product: 'opsfinance';
  idle_seconds: number;
  max_session_seconds: number;
}

export async function redeemMyopsTicket(config: MyopsTransportConfig, ticket: string, transport: typeof fetch = fetch): Promise<MyopsGrant> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) throw new Error('Invalid launch ticket.');
  const result = await requestMyops(config, 'redeem', { ticket }, transport) as Partial<MyopsGrant> | null;
  if (!result || result.product !== 'opsfinance' || !UUID.test(result.session_id ?? '')
      || !/^[A-Za-z0-9_-]{43}$/.test(result.user_ref ?? '')
      || !Number.isInteger(result.idle_seconds) || result.idle_seconds! <= 0 || result.idle_seconds! > 900
      || !Number.isInteger(result.max_session_seconds) || result.max_session_seconds! <= 0 || result.max_session_seconds! > 43200) {
    throw new Error('Invalid MYOPS grant.');
  }
  return result as MyopsGrant;
}

// Fresh, server-side check on each protected operation. A failed lookup never grants access.
export async function checkMyopsEntitlement(config: MyopsTransportConfig, sessionId: string, activity: boolean,
  transport: typeof fetch = fetch): Promise<void> {
  if (!UUID.test(sessionId)) throw new Error('Invalid application session.');
  const result = await requestMyops(config, 'entitlement', {
    session_id: sessionId, product: 'opsfinance', activity,
  }, transport) as { entitled?: boolean; session_active?: boolean } | null;
  if (result?.entitled !== true || result?.session_active !== true) throw new Error('MYOPS access denied.');
}
