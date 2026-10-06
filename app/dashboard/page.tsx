import { redirect } from 'next/navigation';

import { LogoutButton } from '../../components/logout-button';
import { DashboardWorkflow } from '../../components/dashboard-workflow';
import { resolveCurrentBusinessForUser } from '../../lib/auth/business';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const { business, error: contextError } = await resolveCurrentBusinessForUser(supabase, user.id);

  return (
    <>
      <DashboardWorkflow businessId={business?.id ?? undefined} businessName={business?.name ?? 'No active business'} />
      <div style={{ padding: '1rem 2rem 2rem' }}>
        <p>Authenticated user: {user.email ?? user.id}</p>
        <p>{business ? `Current business: ${business.name}` : 'No business is yet linked to this user. A real business is being resolved from Supabase.'}</p>
        {contextError ? <p style={{ color: '#b91c1c' }}>{contextError}</p> : null}
        <LogoutButton />
      </div>
    </>
  );
}
