import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';

import { ChartOfAccountsWorkflow } from '../components/chart-of-accounts-workflow';

afterEach(() => {
  vi.unstubAllGlobals();
});

it('supports creating and editing hierarchical ledger accounts', async () => {
  const fetchMock = vi.fn(async (_url, init) => ({
    ok: true,
    json: async () => init?.method === 'PUT' ? { account: { id: 'cash-ledger' } } : { accounts: [
      { id: 'assets', code: '1000', name: 'Assets', account_type: 'ASSET', normal_balance: 'DEBIT', parent_id: null, is_system: true, is_active: true },
      { id: 'cash-ledger', code: '1100', name: 'Cash', account_type: 'ASSET', normal_balance: 'DEBIT', parent_id: 'assets', is_system: false, is_active: true },
    ] },
  }));
  vi.stubGlobal('fetch', fetchMock);

  render(<ChartOfAccountsWorkflow businessId="business-1" />);
  await screen.findByText('Cash');

  fireEvent.click(screen.getByRole('button', { name: 'Edit Cash' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Operating Cash' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save account' }));

  await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true));
  const update = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
  expect(JSON.parse(String(update?.[1]?.body))).toMatchObject({
    id: 'cash-ledger',
    parent_id: 'assets',
    name: 'Operating Cash',
    is_active: true,
  });
});
