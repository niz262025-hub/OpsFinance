// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { client } = vi.hoisted(() => ({ client: { auth: { getUser: vi.fn() }, from: vi.fn(), rpc: vi.fn() } }));
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: async () => client }));
import { POST } from '../app/api/transactions/route';
const body = { businessId: 'business-a', type: 'JOURNAL', date: '2026-11-12', description: 'UAT capital', idempotency_key: 'uat-journal-1', lines: [{ account_id: 'cash', debit: '25.00' }, { account_id: 'capital', credit: '25.00' }] };
let authorized: boolean;
const post = (payload: unknown) => POST(new Request('https://app.example/api/transactions', { method: 'POST', body: JSON.stringify(payload) }));
beforeEach(() => {
 vi.clearAllMocks(); authorized = true;
 client.auth.getUser.mockResolvedValue({ data: { user: { id: 'user' } }, error: null });
 client.rpc.mockResolvedValue({ data: { status: 'POSTED' }, error: null });
 client.from.mockImplementation(table => {
  const builder: any = { select: () => builder, eq: () => builder, in: async () => ({ data: authorized ? [{ id: 'cash' }, { id: 'capital' }] : [{ id: 'cash' }], error: null }), then: (resolve: any) => resolve({ data: table === 'business_members' ? [{ business_id: 'business-a' }] : [], error: null }) };
  return builder;
 });
});
describe('general journal route', () => {
 it('posts explicit balanced lines without requiring a financial account', async () => {
  expect((await post(body)).status).toBe(200);
  expect(client.rpc).toHaveBeenCalledWith('post_accounting_transaction_atomic', expect.objectContaining({ p_business_id: 'business-a', p_financial_account_id: null, p_amount: '25.00', p_idempotency_key: 'uat-journal-1', p_lines: expect.arrayContaining([expect.objectContaining({ account_id: 'cash', debit: '25.00', credit: '0.00' })]) }));
 });
 it('denies another business before any RPC', async () => { expect((await post({ ...body, businessId: 'business-b' })).status).toBe(403); expect(client.rpc).not.toHaveBeenCalled(); });
 it('denies inactive or cross-business line accounts', async () => { authorized = false; expect((await post(body)).status).toBe(400); expect(client.rpc).not.toHaveBeenCalled(); });
 it.each([{ date: '2026-02-30' }, { idempotency_key: '' }, { lines: [{ account_id: 'cash', debit: '25' }, { account_id: 'capital', credit: '24' }] }])('rejects invalid journal %j', async change => { expect((await post({ ...body, ...change })).status).toBe(400); expect(client.rpc).not.toHaveBeenCalled(); });
 it('preserves database period-lock errors', async () => { client.rpc.mockResolvedValue({ data: null, error: { message: 'Accounting period is locked.' } }); const result = await post(body); expect(result.status).toBe(400); expect(await result.json()).toMatchObject({ error: 'Accounting period is locked.' }); });
});
