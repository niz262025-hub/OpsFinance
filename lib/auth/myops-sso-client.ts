import { createHash, createPrivateKey, randomBytes, sign } from 'node:crypto';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Endpoint = 'redeem' | 'entitlement';

export type MyopsRedeemResult = {
  session_id: string;
  user_ref: string;
  product: string;
  idle_seconds: number;
  max_session_seconds: number;
};

export type MyopsEntitlementResult = {
  entitled: boolean;
  session_active: boolean;
  checked_at?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TICKET = /^[A-Za-z0-9_-]{43}$/;

export function canonicalJson(value: Json): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Invalid JSON value');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function canonicalRequest(endpoint: Endpoint, appId: string, keyVersion: string,
  timestamp: string, nonce: string, body: Json): string {
  const hash = createHash('sha256').update(canonicalJson(body)).digest('hex');
  return `POST\n/api/app/${endpoint}\n${appId}\n${keyVersion}\n${timestamp}\n${nonce}\n${hash}`;
}

function configuration() {
  const base = process.env.MYOPS_SSO_BASE_URL;
  const appId = process.env.MYOPS_SSO_APP_ID;
  const key = process.env.MYOPS_SSO_ED25519_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const keyVersion = process.env.MYOPS_SSO_KEY_VERSION ?? 'current';
  if (!base || !appId || !/^[a-z][a-z0-9_-]{1,31}$/.test(appId) || !key
      || (keyVersion !== 'current' && keyVersion !== 'next')) {
    throw new Error('MYOPS SSO server credentials are not configured');
  }
  const origin = new URL(base);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash
      || origin.pathname !== '/' || !origin.hostname) {
    throw new Error('Invalid MYOPS SSO origin');
  }
  const privateKey = createPrivateKey(key);
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('MYOPS SSO requires Ed25519 credentials');
  return { origin: origin.origin, appId, keyVersion, privateKey };
}

async function signedPost(endpoint: Endpoint, body: Json): Promise<unknown> {
  const { origin, appId, keyVersion, privateKey } = configuration();
  const timestamp = String(Date.now());
  const nonce = randomBytes(24).toString('base64url');
  const message = canonicalRequest(endpoint, appId, keyVersion, timestamp, nonce, body);
  const signature = sign(null, Buffer.from(message), privateKey).toString('base64url');
  const response = await fetch(`${origin}/api/app/${endpoint}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-myops-app-id': appId,
      'x-myops-key-version': keyVersion,
      'x-myops-timestamp': timestamp,
      'x-myops-nonce': nonce,
      'x-myops-signature': signature,
    },
    body: canonicalJson(body),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`MYOPS SSO ${endpoint} failed (HTTP ${response.status})`);
  return response.json();
}

/** Server-only: do not import into client components. Do not log tickets. */
export async function redeemMyopsTicket(ticket: string): Promise<MyopsRedeemResult> {
  if (!TICKET.test(ticket)) throw new Error('Invalid MYOPS launch ticket');
  const value = await signedPost('redeem', { ticket }) as Partial<MyopsRedeemResult>;
  if (!UUID.test(value.session_id ?? '') || !/^[A-Za-z0-9_-]{43}$/.test(value.user_ref ?? '')
      || value.product !== 'opsfinance' || !Number.isInteger(value.idle_seconds)
      || !Number.isInteger(value.max_session_seconds) || (value.idle_seconds ?? 0) <= 0
      || (value.max_session_seconds ?? 0) <= 0) {
    throw new Error('Invalid MYOPS redeem response');
  }
  return value as MyopsRedeemResult;
}

/** Server-only; call on protected requests and after logout/revocation-sensitive actions. */
export async function checkMyopsEntitlement(sessionId: string, activity = false): Promise<boolean> {
  if (!UUID.test(sessionId)) return false;
  const value = await signedPost('entitlement', {
    session_id: sessionId, product: 'opsfinance', sensitive: false, activity,
  }) as Partial<MyopsEntitlementResult>;
  return value.entitled === true && value.session_active === true;
}
