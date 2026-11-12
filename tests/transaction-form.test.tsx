import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionWorkflow } from '../components/transaction-workflow';

const accounts = { accounts: [{ id: 'sales', name: 'Sales' }], financialAccounts: [{ id: 'bank', name: 'UAT Bank' }], transactions: [] };
const response = (data: unknown, ok = true) => ({ ok, json: async () => data });
let requests: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 7, 0, 15));
  requests = vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'POST' ? response({}) : response(accounts));
  vi.stubGlobal('fetch', requests);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const posts = () => requests.mock.calls.filter(([, init]) => init?.method === 'POST');
async function openForm() {
  render(<TransactionWorkflow businessId="biz" defaultType="MONEY_OUT" />);
  await screen.findByRole('option', { name: 'UAT Bank' });
  await waitFor(() => expect((screen.getByRole('button', { name: 'Create posting' }) as HTMLButtonElement).disabled).toBe(false));
}
function selectAccounts() {
  fireEvent.change(screen.getByLabelText('Financial account'), { target: { value: 'bank' } });
  fireEvent.change(screen.getByLabelText('Ledger account'), { target: { value: 'sales' } });
}
describe('transaction entry safety', () => {
  it('refreshes financial accounts when returning from the account creation tab', async () => {
    await openForm();
    requests.mockResolvedValue(response({ ...accounts, financialAccounts: [...accounts.financialAccounts, { id: 'cash', name: 'UAT Cash' }] }));
    fireEvent.focus(window);
    await screen.findByRole('option', { name: 'UAT Cash' });
    fireEvent.change(screen.getByLabelText('Financial account'), { target: { value: 'cash' } });
    expect((screen.getByLabelText('Financial account') as HTMLSelectElement).value).toBe('cash');
  });
  it('starts on the local current date without example amounts, references or account choices', async () => {
    await openForm();
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-11-07');
    for (const label of ['Amount', 'Description', 'Reference', 'Financial account', 'Ledger account']) {
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe('');
    }
    expect((screen.getByLabelText('Type') as HTMLSelectElement).value).toBe('MONEY_OUT');
    fireEvent.click(screen.getByRole('button', { name: 'Create posting' }));
    expect(screen.getByRole('alert').textContent).toContain('Select a financial account');
    expect(posts()).toHaveLength(0);
  });
  it.each(['', '0', '-1', 'NaN', '1.001', '1e3'])('does not send invalid amount %j to the posting API', async amount => {
    await openForm(); selectAccounts();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: amount } });
    fireEvent.click(screen.getByRole('button', { name: 'Create posting' }));
    expect(screen.getByRole('alert').textContent).toContain('greater than RM0');
    expect(posts()).toHaveLength(0);
  });
  it('requires a date and description without sending a partial transaction', async () => {
    await openForm(); selectAccounts();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '12.50' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create posting' }));
    expect(screen.getByRole('alert').textContent).toContain('transaction date');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-07' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create posting' }));
    expect(screen.getByRole('alert').textContent).toContain('description');
    expect(posts()).toHaveLength(0);
  });
  it('sends one request while pending, retains entered data on failure and clears it only after success', async () => {
    let finish: (value: unknown) => void = () => {};
    requests.mockImplementation(async (_url: string, init?: RequestInit) => init?.method === 'POST'
      ? new Promise(resolve => { finish = resolve; }) : response(accounts));
    await openForm(); selectAccounts();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '12.50' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: ' Office supplies ' } });
    fireEvent.change(screen.getByLabelText('Reference'), { target: { value: ' TEST-12 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create posting' }));
    const pending = screen.getByRole('button', { name: 'Posting…' }) as HTMLButtonElement;
    expect(pending.disabled).toBe(true); fireEvent.click(pending);
    expect(posts()).toHaveLength(1);
    expect(JSON.parse(posts()[0][1]!.body as string)).toMatchObject({ amount: '12.50', description: 'Office supplies', reference_no: 'TEST-12', type: 'MONEY_OUT' });
    finish(response({ error: 'Posting unavailable. Try again.' }, false));
    await screen.findByRole('alert');
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('12.50');
    await waitFor(() => expect((screen.getByRole('button', { name: 'Create posting' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Create posting' }));
    expect(posts()).toHaveLength(2);
    const firstKey = JSON.parse(posts()[0][1]!.body as string).idempotency_key;
    expect(firstKey).toBeTruthy();
    expect(JSON.parse(posts()[1][1]!.body as string).idempotency_key).toBe(firstKey);
    finish(response({}));
    await screen.findByRole('status');
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Description') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Reference') as HTMLInputElement).value).toBe('');
  });
});
