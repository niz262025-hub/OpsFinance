import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthenticatedAppShell } from '../components/authenticated-shell';
import { FinancialAccountsWorkflow } from '../components/financial-accounts-workflow';

vi.mock('next/navigation', () => ({
  usePathname: () => '/accounts/financial',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('../lib/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    auth: { signOut: vi.fn() },
  }),
}));

describe('financial account ui', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders the create account action and submits an account creation request', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ financialAccounts: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          financialAccount: {
            id: 'fa-123',
            name: 'Main Bank',
            account_code: 'MAIN-BANK',
            type: 'BANK',
            currency: 'MYR',
            status: 'ACTIVE',
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    render(<FinancialAccountsWorkflow businessId="business-1" businessContextError={null} />);

    expect(await screen.findByRole('button', { name: /\+ Create Account/i })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Main Bank' } });
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'MAIN-BANK' } });
    fireEvent.click(screen.getByRole('button', { name: /\+ Create Account/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe('/api/financial-accounts');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      businessId: 'business-1',
      name: 'Main Bank',
      accountCode: 'MAIN-BANK',
      type: 'BANK',
      currency: 'MYR',
    });
  });

  it('keeps the authenticated shell main content scrollable', () => {
    render(
      <AuthenticatedAppShell businessName="Demo Business" userEmail="owner@example.test">
        <div>Page body</div>
      </AuthenticatedAppShell>,
    );

    const main = document.querySelector('main');
    expect(main).not.toBeNull();
    expect((main as HTMLElement).style.overflowY).toBe('auto');
    expect((main as HTMLElement).style.overflowX).toBe('hidden');
  });
});
