import { AuthenticatedAppShell } from '../../../components/authenticated-shell';
import { SubscriptionSettings } from '../../../components/subscription-settings';

export default function SubscriptionSettingsPage() {
  return (
    <AuthenticatedAppShell>
      <SubscriptionSettings />
    </AuthenticatedAppShell>
  );
}
