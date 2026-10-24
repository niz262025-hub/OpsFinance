import { createSupabaseAdminClient } from '../supabase/server';

const USER_REF = /^[A-Za-z0-9_-]{43}$/;

/** Resolve only pre-approved MYOPS links. Never create a user or business membership implicitly. */
export async function resolveLinkedOpsFinanceUser(myopsUserRef: string): Promise<string | null> {
  if (!USER_REF.test(myopsUserRef)) throw new Error('Invalid MYOPS user reference');
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('myops_identity_links')
    .select('opsfinance_user_id')
    .eq('myops_user_ref', myopsUserRef)
    .maybeSingle();
  if (error) throw new Error('Identity mapping unavailable');
  if (!data || typeof data.opsfinance_user_id !== 'string') return null;
  // A mapping alone is not authorization; business membership and entitlement
  // must be checked before any application session is established.
  return data.opsfinance_user_id;
}
