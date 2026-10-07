import { createHmac } from 'node:crypto';

export type PaymentProviderName = 'CURLEC';
export type PaymentProviderMode = 'sandbox' | 'live';
export type PaymentStatus = 'INITIATED' | 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

export interface PaymentProviderResponse {
  provider: PaymentProviderName;
  checkoutId: string;
  sessionUrl: string;
  providerReference: string;
  amount: string;
  currency: string;
  mode: PaymentProviderMode;
  status: 'INITIATED' | 'PENDING';
  metadata: Record<string, string>;
}

export interface PaymentWebhookEvent {
  provider: PaymentProviderName;
  eventId: string;
  status: PaymentStatus;
  amount: string;
  currency: string;
  reference: string;
  businessId: string;
  subscriptionId: string;
  failureReason?: string | null;
  raw: unknown;
}

export interface PaymentProviderOptions {
  mode?: PaymentProviderMode;
  secret?: string;
}

export abstract class PaymentProvider {
  public abstract readonly providerName: PaymentProviderName;
  public abstract readonly mode: PaymentProviderMode;

  public abstract createCheckoutSession(input: {
    businessId: string;
    subscriptionId: string;
    amount: string;
    currency?: string;
    customerEmail?: string;
    customerName?: string;
    reference?: string;
    metadata?: Record<string, string>;
  }): PaymentProviderResponse;

  public abstract verifyWebhookSignature(rawBody: string, signatureHeader?: string | null): boolean;

  public abstract parseWebhookEvent(payload: unknown): PaymentWebhookEvent;
}

export class CurlecPaymentProvider extends PaymentProvider {
  public readonly providerName: PaymentProviderName = 'CURLEC';
  public readonly mode: PaymentProviderMode;
  private readonly secret: string;

  constructor(options: PaymentProviderOptions = {}) {
    super();
    this.mode = options.mode ?? 'sandbox';
    this.secret = options.secret ?? (this.mode === 'live' ? '' : 'sandbox-curlec-secret');
  }

  createCheckoutSession(input: {
    businessId: string;
    subscriptionId: string;
    amount: string;
    currency?: string;
    customerEmail?: string;
    customerName?: string;
    reference?: string;
    metadata?: Record<string, string>;
  }): PaymentProviderResponse {
    if (this.mode === 'live' && !this.secret) {
      throw new Error('Curlec live credentials are not configured. Payment onboarding required.');
    }

    const amount = input.amount || '29.00';
    const currency = input.currency || 'MYR';
    const reference = input.reference || `curlec-${Date.now()}`;
    const checkoutId = `curlec_${Date.now()}_${Math.random().toString(16).slice(2, 9)}`;
    const metadata = {
      business_id: input.businessId,
      subscription_id: input.subscriptionId,
      ...(input.metadata ?? {}),
    };

    return {
      provider: 'CURLEC',
      checkoutId,
      sessionUrl: this.mode === 'live'
        ? `https://checkout.curlec.com/session/${checkoutId}`
        : `https://sandbox.curlec.com/session/${checkoutId}`,
      providerReference: reference,
      amount,
      currency,
      mode: this.mode,
      status: 'INITIATED',
      metadata,
    };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader?: string | null): boolean {
    const signature = (signatureHeader ?? '').trim();

    if (this.mode === 'sandbox' && !signature) {
      return true;
    }

    if (!this.secret) {
      return false;
    }

    const expected = createHmac('sha256', this.secret).update(rawBody, 'utf8').digest('hex');
    const normalized = signature.toLowerCase();
    const expectedNormalized = expected.toLowerCase();

    return normalized === expectedNormalized || normalized === `sha256=${expectedNormalized}`;
  }

  parseWebhookEvent(payload: unknown): PaymentWebhookEvent {
    const event = (payload ?? {}) as Record<string, any>;
    const eventId = String(event.event_id ?? event.id ?? event.provider_event_id ?? `curlec-${Date.now()}`);
    const statusValue = String(event.status ?? event.payment_status ?? 'PAID').toUpperCase();
    const normalizedStatus: PaymentStatus =
      statusValue === 'SUCCESS' || statusValue === 'PAID' ? 'PAID'
      : statusValue === 'PENDING' ? 'PENDING'
      : statusValue === 'AUTHORIZED' ? 'AUTHORIZED'
      : statusValue === 'FAILED' || statusValue === 'DECLINED' ? 'FAILED'
      : statusValue === 'CANCELLED' ? 'CANCELLED'
      : statusValue === 'REFUNDED' ? 'REFUNDED'
      : 'INITIATED';

    return {
      provider: 'CURLEC',
      eventId,
      status: normalizedStatus,
      amount: String(event.amount ?? event.amount_rm ?? event.total_amount ?? '29.00'),
      currency: String(event.currency ?? 'MYR'),
      reference: String(event.reference ?? event.provider_reference ?? event.order_id ?? event.id ?? eventId),
      businessId: String(event.business_id ?? event.metadata?.business_id ?? ''),
      subscriptionId: String(event.subscription_id ?? event.metadata?.subscription_id ?? ''),
      failureReason: event.failure_reason ?? event.failureReason ?? null,
      raw: payload,
    };
  }
}

export function resolveNextSubscriptionStatus(currentStatus: string, paymentStatus: PaymentStatus): string {
  if (paymentStatus === 'PAID') {
    return 'ACTIVE';
  }

  if (paymentStatus === 'FAILED' && currentStatus === 'ACTIVE') {
    return 'PAST_DUE';
  }

  if (paymentStatus === 'FAILED' && currentStatus === 'TRIAL') {
    return 'TRIAL';
  }

  if (paymentStatus === 'CANCELLED') {
    return 'CANCELLED';
  }

  return currentStatus;
}

export class PaymentIdempotencyGuard {
  private readonly processed = new Set<string>();

  public markProcessed(eventId: string): boolean {
    if (this.processed.has(eventId)) {
      return false;
    }
    this.processed.add(eventId);
    return true;
  }
}
