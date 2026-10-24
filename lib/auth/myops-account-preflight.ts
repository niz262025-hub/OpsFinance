import { hasLinkedBusinessMembership, resolveLinkedOpsFinanceUser } from './myops-identity';

/** Resolve a verified MYOPS identity before starting a Supabase sign-in. */
export async function requireLinkedFinanceAccount(userRef: string): Promise<string> {
  const userId = await resolveLinkedOpsFinanceUser(userRef);
  if (!userId) throw new Error('OpsFinance account is not linked');
  if (!(await hasLinkedBusinessMembership(userId))) {
    throw new Error('OpsFinance business membership is missing');
  }
  return userId;
}
