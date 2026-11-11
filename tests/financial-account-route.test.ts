// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  rpc: vi.fn(),
  membershipQuery: {
    select: vi.fn(),
    eq: vi.fn(),
  },
}));

vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: mocks.client }));

import { POST } from '../app/api/financial-accounts/route';

afterEach(() => vi.resetAllMocks());

it('creates a bank account through the atomic ledger RPC without requiring a selected ledger', async () => {
  const membershipQuery = mocks.membershipQuery;
  membershipQuery.select.mockReturnValue(membershipQuery);
  membershipQuery.eq.mockResolvedValue({ data: [{ business_id: 'business-1' }], error: null });
  mocks.rpc.mockResolvedValue({
    data: {
      financialAccount: { id: 'bank-1', account_id: 'ledger-1' },
      autoCreatedLedger: true,
    },
    error: null,
  });
  mocks.client.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
    from: vi.fn(() => membershipQuery),
    rpc: mocks.rpc,
  });

  const response = await POST(new Request('https://finance.example/api/financial-accounts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      businessId: 'business-1',
      name: 'Operating Bank',
      type: 'BANK',
      accountCode: 'OPERATING-BANK',
      bankName: 'Example Bank',
      companyName: 'Example Company',
      accountNumber: '001234',
      currency: 'MYR',
      openingBalance: '0.00',
      accountId: null,
    }),
  }));

  expect(response.status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith('create_financial_account_with_ledger', expect.objectContaining({
    p_business_id: 'business-1',
    p_type: 'BANK',
    p_account_code: 'OPERATING-BANK',
    p_account_id: null,
  }));
  await expect(response.json()).resolves.toMatchObject({
    financialAccount: { id: 'bank-1', account_id: 'ledger-1' },
    autoCreatedLedger: true,
  });
});
