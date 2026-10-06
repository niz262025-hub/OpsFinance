import { redirect } from 'next/navigation';

import { ChartOfAccountsWorkflow } from '../../../components/chart-of-accounts-workflow';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export default async function ChartOfAccountsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const { data: memberships } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id);

  const businessId = memberships?.[0]?.business_id ?? undefined;

  return <ChartOfAccountsWorkflow businessId={businessId} />;
}
