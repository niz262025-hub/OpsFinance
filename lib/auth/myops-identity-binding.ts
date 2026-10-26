/**
 * Server-only MYOPS -> OpsFinance account authorization.
 *
 * Deliberately separates verifying account binding from creating a session.
 * A MYOPS launch ticket does NOT authorize Supabase Auth or bypass RLS.
 * Binding records must be provisioned through an audited staging-only
 * administrative workflow; NEVER infer identity from an email address.
 */
export type VerifiedOpsFinanceBinding = {
  userId: string;
  businessId: string;
};

type IdentityReader = {
  findBinding(userRef: string): Promise<{ user_id: string; business_id: string; enabled: boolean } | null>;
  isActiveAuthUser(userId: string): Promise<boolean>;
  hasBusinessMembership(userId: string, businessId: string): Promise<boolean>;
};

const USER_REF = /^[A-Za-z0-9_-]{43}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Fail closed unless all three independently verified facts hold:
 * explicit privileged mapping; existing active Auth user; actual membership.
 * Do not invoke this reader through a browser client or anon Supabase key.
 */
export async function resolveMyopsIdentityBinding(
  userRef: string,
  reader: IdentityReader,
): Promise<VerifiedOpsFinanceBinding | null> {
  if (typeof userRef !== 'string' || !USER_REF.test(userRef)) return null;
  const binding = await reader.findBinding(userRef);
  if (!binding?.enabled || !UUID.test(binding.user_id) || !UUID.test(binding.business_id)) return null;
  const [active, member] = await Promise.all([
    reader.isActiveAuthUser(binding.user_id),
    reader.hasBusinessMembership(binding.user_id, binding.business_id),
  ]);
  if (!active || !member) return null;
  return { userId: binding.user_id, businessId: binding.business_id };
}
