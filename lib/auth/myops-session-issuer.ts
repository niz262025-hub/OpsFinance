import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient, getSupabaseServerConfig } from '../supabase/server';

/** Exchange a server-generated magic-link token for a genuine Supabase session. */
export async function createLinkedAuthSession(expectedUserId: string) {
  const admin = createSupabaseAdminClient();
  const userResult = await admin.auth.admin.getUserById(expectedUserId);
  const email = userResult.data.user?.email;
  if (userResult.error || !email || !userResult.data.user?.email_confirmed_at) {
    throw new Error('Linked Supabase identity is unavailable');
  }
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = link.data.properties?.hashed_token;
  if (link.error || !tokenHash) throw new Error('Unable to generate sign-in token');
  const { url, anonKey } = getSupabaseServerConfig();
  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const verified = await auth.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
  if (verified.error || verified.data.user?.id !== expectedUserId || !verified.data.session) {
    throw new Error('Supabase identity verification failed');
  }
  return verified.data.session;
}
