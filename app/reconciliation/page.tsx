import { redirect } from 'next/navigation';

import { ReconciliationWorkflow } from '../../components/reconciliation-workflow';
import { resolveCurrentBusinessForUser } from '../../lib/auth/business';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export default async function ReconciliationPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const { business, error: businessContextError } = await resolveCurrentBusinessForUser(supabase, user.id);

  return <ReconciliationWorkflow businessId={business?.id ?? undefined} businessContextError={businessContextError ?? null} />;
}
