import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ rows: [] as any[], ranges: [] as number[][], failAfterFirstPage: false }));
vi.mock('../lib/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({ from: (table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      range: async (from: number, to: number) => {
        state.ranges.push([from, to]);
        return state.failAfterFirstPage && from > 0
          ? { data: null, error: { message: 'Journal page unavailable' } }
          : { data: state.rows.slice(from, to + 1), error: null };
      },
      then: (resolve: (value: unknown) => unknown) => resolve({ data: table === 'accounts' ? [
        { id: 'bank', business_id: 'biz', code: '1100', name: 'Bank', account_type: 'ASSET', normal_balance: 'DEBIT', is_active: true },
        { id: 'sales', business_id: 'biz', code: '4000', name: 'Sales', account_type: 'REVENUE', normal_balance: 'CREDIT', is_active: true },
      ] : [], error: null }),
    };
    return query;
  } }),
}));
vi.mock('./../components/business-onboarding', () => ({ BusinessOnboarding: () => null }));
import { DashboardWorkflow } from '../components/dashboard-workflow';

afterEach(() => { cleanup(); state.ranges = []; state.failAfterFirstPage = false; });
const journals = (count: number) => Array.from({ length: count }, (_, index) => ({
  id: `journal-${index}`, business_id: 'biz', journal_no: `J-${index}`, journal_date: '2026-11-01',
  created_at: '2026-11-01T12:00:00Z', description: `Receipt ${index}`, status: 'POSTED',
  journal_lines: [
    { id: `d-${index}`, journal_entry_id: `journal-${index}`, account_id: 'bank', debit: '1.00', credit: '0.00' },
    { id: `c-${index}`, journal_entry_id: `journal-${index}`, account_id: 'sales', debit: '0.00', credit: '1.00' },
  ],
}));

describe('dashboard financial totals', () => {
  it('uses every journal beyond the API row limit while showing only six recent receipts', async () => {
    state.rows = journals(1001);
    const { container } = render(<DashboardWorkflow businessId="biz" />);
    await waitFor(() => expect(container.querySelectorAll('.opsfinance-stat-card').length).toBe(4));
    const cards = Array.from(container.querySelectorAll('.opsfinance-stat-card'));
    expect(cards.find(card => card.textContent?.includes('Sales / Revenue'))?.textContent).toContain('RM1001.00');
    expect(cards.find(card => card.textContent?.includes('Net Profit'))?.textContent).toContain('RM1001.00');
    expect(state.ranges).toEqual([[0, 499], [500, 999], [1000, 1499]]);
    const recent = container.querySelectorAll('.opsfinance-txn-item');
    expect(recent.length).toBe(6);
    expect(recent[0].textContent).toContain('RM1.00');
    expect(recent[0].textContent).not.toContain('RM0.00');
  });
  it('shows an error instead of incomplete totals when a later journal page fails', async () => {
    state.rows = journals(501); state.failAfterFirstPage = true;
    const { container } = render(<DashboardWorkflow businessId="biz" />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Journal page unavailable'));
    expect(container.querySelector('.opsfinance-stat-card')).toBeNull();
  });
});
