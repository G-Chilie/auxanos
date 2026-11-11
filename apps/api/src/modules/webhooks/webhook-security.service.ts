import { createHmac, timingSafeEqual } from 'node:crypto';

export type PaymentRailProvider =
  | 'UK_FASTER_PAYMENTS_BAAS'
  | 'PAYSTACK_NGN'
  | 'GHANA_MOMO_GIP'
  | 'SAFARICOM_MPESA_KES';

export interface SignedWebhookEnvelope {
  provider: PaymentRailProvider;
  eventId: string;
  timestampSeconds: number;
  rawPayload: string;
  signatureHex: string;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  provider: PaymentRailProvider;
  eventId: string;
  verifiedAt: string;
}

export class WebhookSecurityService {
  private readonly processedEventIds = new Set<string>();
  private readonly maxClockSkewSeconds = 300; // 5-minute replay window

  /**
   * Computes an HMAC-SHA256 digest over `<timestampSeconds>.<rawPayload>`
   */
  public static computeSignature(
    secret: string,
    timestampSeconds: number,
    rawPayload: string,
  ): string {
    const signedContent = `${timestampSeconds}.${rawPayload}`;
    return createHmac('sha256', secret).update(signedContent, 'utf8').digest('hex');
  }

  /**
   * Verifies an inbound payment rail webhook using:
   * 1. Replay window validation (+/- 300 seconds)
   * 2. Constant-time HMAC-SHA256 comparison (crypto.timingSafeEqual) to prevent timing side-channel attacks
   * 3. Event ID deduplication to block replay of previously processed webhooks
   */
  public verifyAndLockWebhook(
    envelope: SignedWebhookEnvelope,
    providerWebhookSecret: string,
    nowSeconds: number = Math.floor(Date.now() / 1000),
  ): WebhookVerificationResult {
    if (!envelope.eventId || envelope.eventId.trim().length === 0) {
      throw new Error('Webhook envelope is missing a valid eventId.');
    }

    // 1. Replay timestamp tolerance check
    const ageSeconds = Math.abs(nowSeconds - envelope.timestampSeconds);
    if (ageSeconds > this.maxClockSkewSeconds) {
      throw new Error(
        `Webhook timestamp outside allowed 300s replay window (skew: ${ageSeconds}s).`,
      );
    }

    // 2. Compute expected HMAC-SHA256 signature and compare in constant time
    const expectedHex = WebhookSecurityService.computeSignature(
      providerWebhookSecret,
      envelope.timestampSeconds,
      envelope.rawPayload,
    );

    const expectedBuf = Buffer.from(expectedHex, 'hex');
    const receivedBuf = Buffer.from(envelope.signatureHex, 'hex');

    if (
      expectedBuf.length !== receivedBuf.length ||
      !timingSafeEqual(expectedBuf, receivedBuf)
    ) {
      throw new Error(
        `Cryptographic HMAC-SHA256 signature verification failed for provider ${envelope.provider}.`,
      );
    }

    // 3. Deduplicate eventId to prevent webhook replay attacks
    const deduplicationKey = `${envelope.provider}:${envelope.eventId}`;
    if (this.processedEventIds.has(deduplicationKey)) {
      throw new Error(
        `Duplicate webhook replay detected for event ${deduplicationKey}.`,
      );
    }

    this.processedEventIds.add(deduplicationKey);

    return {
      isValid: true,
      provider: envelope.provider,
      eventId: envelope.eventId,
      verifiedAt: new Date(nowSeconds * 1000).toISOString(),
    };
  }
}
