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
    const fetchMock = vi.fn(async (url, init) => {
      if (String(url).startsWith('/api/accounts?')) return {ok:true,json:async()=>({accounts:[
        {id:'ledger-1',code:'1000',name:'Main Cash Ledger',is_active:true},
        {id:'inactive-ledger',code:'9999',name:'Inactive Ledger',is_active:false},
      ]})};
      if (init?.method === 'POST') return {ok:true,json:async()=>({financialAccount:{id:'fa-123',name:'Main Bank',account_code:'MAIN-BANK',type:'BANK',currency:'MYR',status:'ACTIVE'}})};
      return {ok:true,json:async()=>({financialAccounts:[]})};
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<FinancialAccountsWorkflow businessId="business-1" businessContextError={null} />);

    expect(await screen.findByRole('button', { name: /\+ Create Account/i })).toBeTruthy();

    await screen.findByRole('option', {name:'1000 — Main Cash Ledger'});
    expect(screen.queryByRole('option',{name:/Inactive Ledger/})).toBeNull();
    fireEvent.change(screen.getByLabelText('COA mapping'), {target:{value:'ledger-1'}});
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Main Bank' } });
    fireEvent.change(screen.getByLabelText('Bank name'), {target:{value:'Dummy Bank'}});
    fireEvent.change(screen.getByLabelText('Company / account holder name'), {target:{value:'UAT Company'}});
    fireEvent.change(screen.getByLabelText('Account number'), {target:{value:'001235'}});
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'MAIN-BANK' } });
    fireEvent.click(screen.getByRole('button', { name: /\+ Create Account/i }));

    await waitFor(() => expect(fetchMock.mock.calls.some(call=>call[1]?.method==='POST')).toBe(true));
    const post = fetchMock.mock.calls.find(call=>call[1]?.method==='POST')!;
    expect(post[0]).toBe('/api/financial-accounts');
    expect(JSON.parse(String(post[1]?.body))).toMatchObject({
      bankName:'Dummy Bank',companyName:'UAT Company',accountNumber:'001235',
      accountId: 'ledger-1',
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
