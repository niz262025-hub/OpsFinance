import { redirect } from 'next/navigation';

import { FinancialAccountsWorkflow } from '../../../components/financial-accounts-workflow';
import { resolveCurrentBusinessForUser } from '../../../lib/auth/business';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export default async function FinancialAccountsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const { business, error: businessContextError } = await resolveCurrentBusinessForUser(supabase, user.id);

  return <FinancialAccountsWorkflow businessId={business?.id ?? undefined} businessContextError={businessContextError ?? null} />;
}
