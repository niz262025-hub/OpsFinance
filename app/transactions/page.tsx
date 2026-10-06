import { redirect } from 'next/navigation';

import { TransactionWorkflow } from '../../components/transaction-workflow';
import { resolveCurrentBusinessForUser } from '../../lib/auth/business';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export default async function TransactionsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const { business, context } = await resolveCurrentBusinessForUser(supabase, user.id);

  return <TransactionWorkflow businessId={business?.id ?? context?.businessId ?? undefined} />;
}
