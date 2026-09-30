import { redirect } from 'next/navigation';

import { LogoutButton } from '../../components/logout-button';
import { DashboardWorkflow } from '../../components/dashboard-workflow';
import { selectCurrentBusiness } from '../../lib/auth/business';
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

  const currentBusiness = selectCurrentBusiness([], user.id);

  return (
    <>
      <DashboardWorkflow />
      <div style={{ padding: '1rem 2rem 2rem' }}>
        <p>Authenticated user: {user.email ?? user.id}</p>
        <p>{currentBusiness ? `Current business: ${currentBusiness.name}` : 'No business is yet linked to this user. Create the first business from the business settings flow.'}</p>
        <LogoutButton />
      </div>
    </>
  );
}
