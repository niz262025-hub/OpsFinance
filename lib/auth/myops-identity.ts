import { createSupabaseAdminClient } from '../supabase/server';

const USER_REF = /^[A-Za-z0-9_-]{43}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isMyopsUserRef(value: unknown): value is string {
  return typeof value === 'string' && USER_REF.test(value);
}

/** Resolve only pre-approved MYOPS links. Never create a user or business membership implicitly. */
export async function resolveLinkedOpsFinanceUser(myopsUserRef: string): Promise<string | null> {
  if (!isMyopsUserRef(myopsUserRef)) throw new Error('Invalid MYOPS user reference');
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('myops_identity_links')
    .select('opsfinance_user_id')
    .eq('myops_user_ref', myopsUserRef)
    .maybeSingle();
  if (error) throw new Error('Identity mapping unavailable');
  if (!data) return null;
  if (typeof data.opsfinance_user_id !== 'string' || !UUID.test(data.opsfinance_user_id)) {
    throw new Error('Invalid linked identity');
  }
  return data.opsfinance_user_id;
}

/** Check business membership independently of the identity link. */
export async function hasLinkedBusinessMembership(userId: string): Promise<boolean> {
  if (!UUID.test(userId)) throw new Error('Invalid OpsFinance user ID');
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from('business_members')
    .select('business_id').eq('user_id', userId).limit(1);
  if (error) throw new Error('Business membership verification unavailable');
  return Array.isArray(data) && data.length > 0 && typeof data[0].business_id === 'string' && UUID.test(data[0].business_id);
}
