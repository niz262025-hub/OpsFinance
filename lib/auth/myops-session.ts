import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { MyopsTransportConfig } from './myops-transport';

export const MYOPS_COOKIE = '__Host-opsfinance-sso';
export interface AppSession {
  version: 1;
  sessionId: string;
  userRef: string;
  userId: string;
  businessId: string;
  accessToken: string;
  expiresAt: number;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function ssoEnabled() { return process.env.MYOPS_SSO_ENABLED === 'true'; }
export function ssoConfig(): { transport: MyopsTransportConfig; appOrigin: string; secret: string } {
  // Production cutover additionally needs a verified Data API broker gate so old local
  // Supabase credentials cannot circumvent central entitlement checks. Not enabled here.
  if (!ssoEnabled() || process.env.NEXT_PUBLIC_MYOPS_SSO_ENABLED !== 'true' || process.env.VERCEL_ENV === 'production') throw new Error('SSO is not enabled for this deployment.');
  const appOrigin = process.env.OPSFINANCE_ORIGIN ?? '';
  const origin = process.env.MYOPS_ORIGIN ?? '';
  for (const value of [appOrigin, origin]) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.origin !== value) throw new Error('Invalid SSO origin.');
  }
  const secret = process.env.MYOPS_APP_SESSION_SECRET ?? '';
  if (secret.length < 32 || !process.env.MYOPS_APP_PRIVATE_KEY) throw new Error('SSO configuration is incomplete.');
  return { appOrigin, secret, transport: { origin, appId: 'opsfinance', keyVersion: 'current', privateKey: process.env.MYOPS_APP_PRIVATE_KEY } };
}
export function sealSession(session: AppSession, secret: string): string {
  if (secret.length < 32) throw new Error('Invalid session key.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv);
  cipher.setAAD(Buffer.from(MYOPS_COOKIE));
  const data = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()]);
  const value = Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
  if (value.length > 3800) throw new Error('Application session exceeds cookie capacity.');
  return value;
}
export function openSession(value: string | undefined, secret: string, now = Date.now()): AppSession | null {
  try {
    if (secret.length < 32 || !value || value.length > 3800 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
    const bytes = Buffer.from(value, 'base64url');
    const cipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), bytes.subarray(0,12));
    cipher.setAAD(Buffer.from(MYOPS_COOKIE)); cipher.setAuthTag(bytes.subarray(12,28));
    const session = JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString()) as AppSession;
    if (session.version !== 1 || !UUID.test(session.sessionId) || !UUID.test(session.userId) || !UUID.test(session.businessId)
      || !/^[A-Za-z0-9_-]{43}$/.test(session.userRef) || typeof session.accessToken !== 'string' || !session.accessToken
      || !Number.isSafeInteger(session.expiresAt) || session.expiresAt <= now || session.expiresAt > now + 43200000) return null;
    return session;
  } catch { return null; }
}
