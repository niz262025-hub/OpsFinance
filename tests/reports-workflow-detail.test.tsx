import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../lib/auth/navigation', () => ({ isPreviewAuthBypassEnabled: () => false }));
vi.mock('../lib/supabase/client', () => ({ getSupabaseBrowserClient: () => ({ from: (table: string) => {
  const q = { select: () => q, eq: () => q, order: () => q,
    then: (done: (value: unknown) => unknown) => done({ error: null, data: table === 'accounts' ? [
      { id: 'assets', business_id: 'biz', code: '1000', name: 'Assets', account_type: 'ASSET', normal_balance: 'DEBIT', is_active: true },
      { id: 'cash', business_id: 'biz', code: '1100', name: 'UAT Cash', account_type: 'ASSET', normal_balance: 'DEBIT', is_active: true },
      { id: 'sales', business_id: 'biz', code: '4100', name: 'UAT Sales', account_type: 'REVENUE', normal_balance: 'CREDIT', is_active: true },
    ] : [{ id: 'j1', business_id: 'biz', journal_no: 'UAT-IN-1', journal_date: '2026-10-05', description: 'UAT receipt', status: 'POSTED', journal_lines: [
      { account_id: 'cash', debit: '7.00', credit: '0.00' }, { account_id: 'sales', debit: '0.00', credit: '7.00' },
    ] }] }),
  }; return q;
} }) }));
import { ReportsWorkflow } from '../components/reports-workflow';
afterEach(cleanup);
it.each(['statement', 'ledger'] as const)('shows posted rows and totals for the selected %s account', async report => {
  render(<ReportsWorkflow businessId="biz" defaultReport={report} />);
  await screen.findByRole('option', { name: 'UAT Cash' });
  fireEvent.change(screen.getByRole('combobox', { name: 'Account' }), { target: { value: 'cash' } });
  await waitFor(() => expect(screen.getByText('Closing Balance: RM7.00')).toBeTruthy());
  const table = screen.getByRole('table', { name: 'Posted transactions' });
  expect(within(table).getByText('UAT-IN-1')).toBeTruthy();
  expect(within(table).getByText('UAT receipt')).toBeTruthy();
  expect(within(table).getAllByRole('row')).toHaveLength(2);
  fireEvent.change(screen.getByRole('combobox', { name: 'Account' }), { target: { value: 'assets' } });
  await waitFor(() => expect(screen.getByText('Closing Balance: RM0.00')).toBeTruthy());
  expect(screen.queryByText('UAT-IN-1')).toBeNull();
});
