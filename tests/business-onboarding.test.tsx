import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, refresh, client } = vi.hoisted(() => ({
  rpc: vi.fn(),
  refresh: vi.fn(),
  client: { rpc: vi.fn() },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('../lib/supabase/client', () => ({ getSupabaseBrowserClient: () => client }));

import { BusinessOnboarding } from '../components/business-onboarding';

describe('business onboarding', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
    client.rpc = rpc;
    refresh.mockReset();
  });

  it('creates the owner business through the authenticated RPC, without a billing step', async () => {
    render(<BusinessOnboarding />);
    fireEvent.change(screen.getByLabelText(/Business name/), { target: { value: '  Southern Dotcom  ' } });
    fireEvent.change(screen.getByLabelText(/Registration number/), { target: { value: '  123  ' } });
    fireEvent.change(screen.getByLabelText(/Business email/), { target: { value: 'finance@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create business workspace' }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('create_business_with_owner', {
      p_name: 'Southern Dotcom',
      p_registration_no: '123',
      p_address: null,
      p_phone: null,
      p_email: 'finance@example.com',
      p_base_currency: 'MYR',
      p_fiscal_year_start: null,
    }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(screen.queryByText(/subscription|trial|payment/i)).toBeNull();
  });

  it('shows a retryable error when the database rejects setup', async () => {
    rpc.mockResolvedValue({ error: new Error('Database unavailable') });
    render(<BusinessOnboarding />);
    fireEvent.change(screen.getByLabelText(/Business name/), { target: { value: 'Southern Dotcom' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create business workspace' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Database unavailable');
    expect(refresh).not.toHaveBeenCalled();
  });
});
