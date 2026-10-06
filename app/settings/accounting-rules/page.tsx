import { redirect } from 'next/navigation';

import { AccountingRulesSettings } from '../../../components/accounting-rules-settings';
import { resolveCurrentBusinessForUser } from '../../../lib/auth/business';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export default async function AccountingRulesRoute() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const { business, error: businessContextError } = await resolveCurrentBusinessForUser(supabase, user.id);

  return <AccountingRulesSettings businessId={business?.id ?? null} businessContextError={businessContextError ?? null} />;
}
