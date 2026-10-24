import { describe, expect, it } from 'vitest';
import { isMyopsUserRef } from '../lib/auth/myops-identity';

describe('MYOPS opaque identity reference', () => {
  it('accepts the expected 32-byte base64url HMAC reference', () => {
    expect(isMyopsUserRef('A'.repeat(43))).toBe(true);
    expect(isMyopsUserRef('A'.repeat(42) + '_')).toBe(true);
  });
  it('rejects malformed and untrusted values', () => {
    expect(isMyopsUserRef('')).toBe(false);
    expect(isMyopsUserRef('A'.repeat(42))).toBe(false);
    expect(isMyopsUserRef('A'.repeat(44))).toBe(false);
    expect(isMyopsUserRef('A'.repeat(42) + '=')).toBe(false);
    expect(isMyopsUserRef(null)).toBe(false);
    expect(isMyopsUserRef({ ref: 'A'.repeat(43) })).toBe(false);
  });
});
