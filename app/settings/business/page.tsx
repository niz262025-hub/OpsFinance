import { redirect } from 'next/navigation';

import { BusinessProfileSettings } from '../../../components/business-profile-settings';
import { resolveCurrentBusinessForUser } from '../../../lib/auth/business';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export default async function BusinessProfilePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const { business, error: businessContextError } = await resolveCurrentBusinessForUser(supabase, user.id);

  return <BusinessProfileSettings businessId={business?.id ?? null} businessContextError={businessContextError} />;
}
