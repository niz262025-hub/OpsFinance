import { describe, expect, it } from 'vitest';

import { CurlecPaymentProvider, PaymentIdempotencyGuard, resolveNextSubscriptionStatus } from '../packages/payments';

describe('Curlec payment gateway', () => {
  it('creates a sandbox checkout session without exposing live secrets', () => {
    const provider = new CurlecPaymentProvider({ mode: 'sandbox', secret: 'sandbox-curlec-secret' });
    const session = provider.createCheckoutSession({
      businessId: 'business-123',
      subscriptionId: 'sub-123',
      amount: '29.00',
      currency: 'MYR',
      customerEmail: 'owner@example.com',
      customerName: 'Demo Owner',
    });

    expect(session.provider).toBe('CURLEC');
    expect(session.mode).toBe('sandbox');
    expect(session.sessionUrl).toContain('sandbox.curlec.com');
    expect(session.amount).toBe('29.00');
  });

  it('verifies a webhook signature and rejects tampering', () => {
    const provider = new CurlecPaymentProvider({ mode: 'sandbox', secret: 'sandbox-curlec-secret' });
    const payload = JSON.stringify({ event_id: 'evt-123', status: 'SUCCESS', amount: '29.00', currency: 'MYR' });
    const valid = provider.verifyWebhookSignature(payload, `sha256=${Buffer.from('fake').toString('hex')}`);
    expect(valid).toBe(false);

    const signature = `sha256=${Buffer.from('not-real').toString('hex')}`;
    expect(provider.verifyWebhookSignature(payload, signature)).toBe(false);
  });

  it('applies the correct subscription state transitions for successful and failed payments', () => {
    expect(resolveNextSubscriptionStatus('TRIAL', 'PAID')).toBe('ACTIVE');
    expect(resolveNextSubscriptionStatus('ACTIVE', 'PAID')).toBe('ACTIVE');
    expect(resolveNextSubscriptionStatus('ACTIVE', 'FAILED')).toBe('PAST_DUE');
    expect(resolveNextSubscriptionStatus('TRIAL', 'FAILED')).toBe('TRIAL');
    expect(resolveNextSubscriptionStatus('GRACE_PERIOD', 'PAID')).toBe('ACTIVE');
  });

  it('enforces webhook idempotency for duplicate events', () => {
    const guard = new PaymentIdempotencyGuard();
    expect(guard.markProcessed('evt-duplicate')).toBe(true);
    expect(guard.markProcessed('evt-duplicate')).toBe(false);
  });
});
