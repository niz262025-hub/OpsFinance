import { createHash, createPrivateKey, randomBytes, sign } from 'node:crypto';

/** Server-only MYOPS app client. Never expose the Ed25519 private key to the browser. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  return '{' + Object.keys(value as Record<string, unknown>).sort().map((key) =>
    JSON.stringify(key) + ':' + canonicalJson((value as Record<string, unknown>)[key])).join(',') + '}';
}

export function canonicalMyopsRequest(path: string, appId: string, version: string, timestamp: string, nonce: string, body: Record<string, unknown>): string {
  const hash = createHash('sha256').update(canonicalJson(body)).digest('hex');
  return ['POST', path, appId, version, timestamp, nonce, hash].join('\n');
}

type MyopsSession = { session_id: string; user_ref: string; product: string };

function signingConfig() {
  const base = process.env.MYOPS_APP_API_ORIGIN;
  const appId = process.env.MYOPS_APP_ID;
  const version = process.env.MYOPS_KEY_VERSION || 'current';
  const privateKey = process.env[`MYOPS_APP_PRIVATE_KEY_${version.toUpperCase()}`] || process.env.MYOPS_APP_PRIVATE_KEY;
  let parsedBase: URL;
  try {
    parsedBase = new URL(base || '');
  } catch {
    throw new Error('MYOPS SSO is not configured');
  }
  if (!base || !appId || !privateKey || parsedBase.protocol !== 'https:' || parsedBase.username || parsedBase.password || parsedBase.search || parsedBase.hash || !/^\/$/.test(parsedBase.pathname) || !/^[a-z][a-z0-9_-]{1,31}$/.test(appId) || !['current', 'next'].includes(version)) {
    throw new Error('MYOPS SSO is not configured');
  }
  return { base: parsedBase, appId, version, privateKey };
}

async function callMyops<T>(path: '/api/app/redeem' | '/api/app/entitlement', body: Record<string, unknown>): Promise<T> {
  const { base, appId, version, privateKey } = signingConfig();
  const timestamp = String(Date.now());
  const nonce = randomBytes(24).toString('base64url');
  const message = canonicalMyopsRequest(path, appId, version, timestamp, nonce, body);
  const key = createPrivateKey(privateKey.replace(/\\n/g, '\n'));
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Invalid SSO signing key');
  const signature = sign(null, Buffer.from(message), key).toString('base64url');
  const response = await fetch(new URL(path, base), {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(8000),
    headers: {
      'content-type': 'application/json',
      'x-myops-app-id': appId,
      'x-myops-key-version': version,
      'x-myops-timestamp': timestamp,
      'x-myops-nonce': nonce,
      'x-myops-signature': signature,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('MYOPS ticket redemption failed');
  return await response.json() as T;
}

export async function redeemMyopsTicket(ticket: string): Promise<MyopsSession> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) throw new Error('Invalid ticket');
  const data: unknown = await callMyops<unknown>('/api/app/redeem', { ticket });
  if (!data || typeof data !== 'object') throw new Error('Invalid MYOPS response');
  const value = data as Record<string, unknown>;
  if (value.product !== 'opsfinance' || typeof value.session_id !== 'string' || typeof value.user_ref !== 'string') {
    throw new Error('MYOPS access denied');
  }
  return { session_id: value.session_id, user_ref: value.user_ref, product: value.product };
}

/** Recheck the MYOPS session on protected server requests; network/config errors deny access. */
export async function verifyMyopsAppSession(sessionId: string, activity: boolean, sensitive = false): Promise<boolean> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) return false;
  try {
    const data: unknown = await callMyops<unknown>('/api/app/entitlement', {
      session_id: sessionId,
      product: 'opsfinance',
      activity,
      sensitive,
    });
    if (!data || typeof data !== 'object') return false;
    const value = data as Record<string, unknown>;
    return value.entitled === true && value.session_active === true;
  } catch {
    return false;
  }
}
