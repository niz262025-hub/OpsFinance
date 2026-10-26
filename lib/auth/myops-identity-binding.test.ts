import { describe, expect, it, vi } from 'vitest';
import { resolveMyopsIdentityBinding } from './myops-identity-binding';

const ref = 'u'.repeat(43);
const user = '123e4567-e89b-42d3-a456-426614174000';
const business = '123e4567-e89b-42d3-a456-426614174001';
const authorizedReader = () => ({
  findBinding: vi.fn(async () => ({ user_id: user, business_id: business, enabled: true })),
  isActiveAuthUser: vi.fn(async () => true),
  hasBusinessMembership: vi.fn(async () => true),
});

describe('MYOPS privileged identity binding', () => {
  it('requires exact app-scoped user reference, not email or user-controlled identity', async () => {
    const reader = authorizedReader();
    expect(await resolveMyopsIdentityBinding('admin@example.com', reader)).toBeNull();
    expect(reader.findBinding).not.toHaveBeenCalled();
  });

  it('accepts only explicitly bound active members', async () => {
    const reader = authorizedReader();
    expect(await resolveMyopsIdentityBinding(ref, reader)).toEqual({ userId: user, businessId: business });
    expect(reader.hasBusinessMembership).toHaveBeenCalledWith(user, business);
  });

  it('denies absent/disabled mappings and inactive auth accounts', async () => {
    const missing = authorizedReader();
    missing.findBinding.mockResolvedValueOnce(null as never);
    expect(await resolveMyopsIdentityBinding(ref, missing)).toBeNull();
    const disabled = authorizedReader();
    disabled.findBinding.mockResolvedValueOnce({ user_id: user, business_id: business, enabled: false });
    expect(await resolveMyopsIdentityBinding(ref, disabled)).toBeNull();
    const inactive = authorizedReader();
    inactive.isActiveAuthUser.mockResolvedValueOnce(false);
    expect(await resolveMyopsIdentityBinding(ref, inactive)).toBeNull();
  });

  it('blocks cross-business membership and malformed IDs', async () => {
    const reader = authorizedReader();
    reader.hasBusinessMembership.mockResolvedValueOnce(false);
    expect(await resolveMyopsIdentityBinding(ref, reader)).toBeNull();
    const bad = authorizedReader();
    bad.findBinding.mockResolvedValueOnce({ user_id: 'bad', business_id: business, enabled: true });
    expect(await resolveMyopsIdentityBinding(ref, bad)).toBeNull();
    expect(bad.isActiveAuthUser).not.toHaveBeenCalled();
  });
});
