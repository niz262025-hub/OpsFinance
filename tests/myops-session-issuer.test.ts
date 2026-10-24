import { describe, expect, it, vi } from 'vitest';

const { getUserById, generateLink, verifyOtp } = vi.hoisted(() => ({
  getUserById: vi.fn(), generateLink: vi.fn(), verifyOtp: vi.fn(),
}));
vi.mock('../lib/supabase/server', () => ({
  createSupabaseAdminClient: () => ({ auth: { admin: { getUserById, generateLink } } }),
  getSupabaseServerConfig: () => ({ url: 'https://example.supabase.co', anonKey: 'test-key' }),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { verifyOtp } }),
}));
import { createLinkedAuthSession } from '../lib/auth/myops-session-issuer';

describe('linked Supabase session issuance', () => {
  it('rejects mismatched identities even if token verification succeeds', async () => {
    getUserById.mockResolvedValue({ data: { user: { id: 'expected', email: 'verified@example.com', email_confirmed_at: '2026-01-01' } }, error: null });
    generateLink.mockResolvedValue({ data: { properties: { hashed_token: 'token' } }, error: null });
    verifyOtp.mockResolvedValue({ data: { user: { id: 'different' }, session: { access_token: 'a' } }, error: null });
    await expect(createLinkedAuthSession('expected')).rejects.toThrow('Supabase identity verification failed');
  });
  it('returns the verified session for the exact linked user', async () => {
    getUserById.mockResolvedValue({ data: { user: { id: 'expected', email: 'verified@example.com', email_confirmed_at: '2026-01-01' } }, error: null });
    generateLink.mockResolvedValue({ data: { properties: { hashed_token: 'token' } }, error: null });
    const session = { access_token: 'access', refresh_token: 'refresh' };
    verifyOtp.mockResolvedValue({ data: { user: { id: 'expected' }, session }, error: null });
    await expect(createLinkedAuthSession('expected')).resolves.toEqual(session);
  });
  it('rejects when Supabase returns no session', async () => {
    getUserById.mockResolvedValue({ data: { user: { id: 'expected', email: 'verified@example.com', email_confirmed_at: '2026-01-01' } }, error: null });
    generateLink.mockResolvedValue({ data: { properties: { hashed_token: 'token' } }, error: null });
    verifyOtp.mockResolvedValue({ data: { user: { id: 'expected' }, session: null }, error: null });
    await expect(createLinkedAuthSession('expected')).rejects.toThrow('Supabase identity verification failed');
  });
  it('rejects users without a confirmed email', async () => {
    getUserById.mockResolvedValue({ data: { user: { id: 'expected', email: 'unverified@example.com', email_confirmed_at: null } }, error: null });
    await expect(createLinkedAuthSession('expected')).rejects.toThrow('Linked Supabase identity is unavailable');
  });
});
