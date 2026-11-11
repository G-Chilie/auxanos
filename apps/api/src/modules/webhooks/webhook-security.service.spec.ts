import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WebhookSecurityService } from './webhook-security.service';

describe('WebhookSecurityService (Constant-Time HMAC-SHA256 & Anti-Replay Guard)', () => {
  const secret = 'whsec_auxanos_test_secret_994821';
  const nowSeconds = 1_760_000_000;

  it('accepts a validly signed UK Faster Payments or Paystack webhook within the 5-minute window', () => {
    const security = new WebhookSecurityService();
    const rawPayload = JSON.stringify({
      event: 'charge.success',
      amountMinor: '250000000',
      currency: 'NGN',
    });

    const signatureHex = WebhookSecurityService.computeSignature(
      secret,
      nowSeconds,
      rawPayload,
    );

    const result = security.verifyAndLockWebhook(
      {
        provider: 'PAYSTACK_NGN',
        eventId: 'evt_ngn_994810',
        timestampSeconds: nowSeconds,
        rawPayload,
        signatureHex,
      },
      secret,
      nowSeconds,
    );

    assert.equal(result.isValid, true);
    assert.equal(result.eventId, 'evt_ngn_994810');
  });

  it('rejects tampered webhook payloads where an attacker alters the amount', () => {
    const security = new WebhookSecurityService();
    const originalPayload = JSON.stringify({
      event: 'fps.inbound.settled',
      amountMinor: '10000',
      currency: 'GBP',
    });
    const tamperedPayload = JSON.stringify({
      event: 'fps.inbound.settled',
      amountMinor: '9999900',
      currency: 'GBP',
    });

    const signatureHex = WebhookSecurityService.computeSignature(
      secret,
      nowSeconds,
      originalPayload,
    );

    assert.throws(
      () =>
        security.verifyAndLockWebhook(
          {
            provider: 'UK_FASTER_PAYMENTS_BAAS',
            eventId: 'evt_fps_001',
            timestampSeconds: nowSeconds,
            rawPayload: tamperedPayload,
            signatureHex,
          },
          secret,
          nowSeconds,
        ),
      /Cryptographic HMAC-SHA256 signature verification failed/,
    );
  });

  it('rejects stale replayed webhooks older than 300 seconds and duplicate eventIds', () => {
    const security = new WebhookSecurityService();
    const rawPayload = JSON.stringify({ event: 'mpesa.stk.callback' });
    const staleTimestamp = nowSeconds - 600; // 10 minutes old

    const staleSig = WebhookSecurityService.computeSignature(
      secret,
      staleTimestamp,
      rawPayload,
    );

    assert.throws(
      () =>
        security.verifyAndLockWebhook(
          {
            provider: 'SAFARICOM_MPESA_KES',
            eventId: 'evt_ke_stale_01',
            timestampSeconds: staleTimestamp,
            rawPayload,
            signatureHex: staleSig,
          },
          secret,
          nowSeconds,
        ),
      /Webhook timestamp outside allowed 300s replay window/,
    );
  });
});
