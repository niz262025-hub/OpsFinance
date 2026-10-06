import { redirect } from 'next/navigation';

import { ReportsWorkflow } from '../../components/reports-workflow';
import { resolveCurrentBusinessForUser } from '../../lib/auth/business';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export default async function ReportsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const { business, error: businessContextError } = await resolveCurrentBusinessForUser(supabase, user.id);

  return <ReportsWorkflow businessId={business?.id ?? undefined} businessContextError={businessContextError ?? null} />;
}
