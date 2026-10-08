import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { SubscriptionSettings } from '../components/subscription-settings';

describe('Phase 8 subscription ui contract', () => {
  it('renders the Starter pricing and provider status surface', () => {
    render(createElement(SubscriptionSettings));

    expect(screen.getByText(/OpsFinance current plan/i)).toBeTruthy();
    expect(screen.getByText(/Starter/i)).toBeTruthy();
    expect(screen.getByText(/RM29\/month/i)).toBeTruthy();
    expect(screen.getByText(/Payment provider: Not configured/i)).toBeTruthy();
  });

  it('renders subscription status and deferred payment messaging', () => {
    render(createElement(SubscriptionSettings));

    expect(screen.getByText(/Current status/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Payment history/i })).toBeTruthy();
    expect(screen.getByText(/No payment history yet\. Subscription payment is deferred\./i)).toBeTruthy();
    expect(screen.getByText(/Subscription payment is not yet available\./i)).toBeTruthy();
  });
});
