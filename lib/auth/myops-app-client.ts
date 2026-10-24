import { createHash, createPrivateKey, randomBytes, sign } from 'node:crypto';

/** Server-only MYOPS app client. Never expose the Ed25519 private key to the browser. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  return '{' + Object.keys(value as Record<string, unknown>).sort().map((key) =>
    JSON.stringify(key) + ':' + canonicalJson((value as Record<string, unknown>)[key])).join(',') + '}';
}

export function canonicalMyopsRequest(path: string, appId: string, version: string, timestamp: string, nonce: string, body: Record<string, string>): string {
  const hash = createHash('sha256').update(canonicalJson(body)).digest('hex');
  return ['POST', path, appId, version, timestamp, nonce, hash].join('\\n');
}

export async function redeemMyopsTicket(ticket: string): Promise<{ session_id: string; user_ref: string; product: string }> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) throw new Error('Invalid ticket');
  const base = process.env.MYOPS_APP_API_ORIGIN;
  const appId = process.env.MYOPS_APP_ID;
  const privateKey = process.env.MYOPS_APP_PRIVATE_KEY;
  if (!base || !appId || !privateKey || !/^https:\/\//.test(base) || !/^[a-z][a-z0-9_-]{1,31}$/.test(appId)) {
    throw new Error('MYOPS SSO is not configured');
  }
  const path = '/api/app/redeem';
  const body = { ticket };
  const timestamp = String(Date.now());
  const nonce = randomBytes(24).toString('base64url');
  const version = 'current';
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
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') throw new Error('Invalid MYOPS response');
  const value = data as Record<string, unknown>;
  if (value.product !== 'opsfinance' || typeof value.session_id !== 'string' || typeof value.user_ref !== 'string') {
    throw new Error('MYOPS access denied');
  }
  return { session_id: value.session_id, user_ref: value.user_ref, product: value.product };
}
