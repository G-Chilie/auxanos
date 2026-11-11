import * as assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { describe, it } from 'node:test';
import { createAuxanosApiServer } from './server';

describe('AUXANOS HTTP REST API Server (End-to-End Integration)', () => {
  it('serves health check, supported Africa->UK corridors, FX quotes, and Day-Zero eVisa onboarding over HTTP', async () => {
    const { server } = createAuxanosApiServer();

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // 1. Health & Ledger Audit Chain Endpoint
      const healthRes = await fetch(`${baseUrl}/health`);
      assert.equal(healthRes.status, 200);
      const healthBody = (await healthRes.json()) as {
        status: string;
        service: string;
      };
      assert.equal(healthBody.status, 'ok');
      assert.equal(healthBody.service, '@auxanos/api');

      // 2. FX Quote Endpoint (Nigeria NGN -> UK GBP)
      const quoteRes = await fetch(`${baseUrl}/v1/fx/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceCurrency: 'NGN',
          targetCurrency: 'GBP',
          sourceAmountMinor: '250000000', // ₦2,500,000.00 in kobo
        }),
      });
      assert.equal(quoteRes.status, 201);
      const quoteBody = (await quoteRes.json()) as {
        quoteId: string;
        netTargetFormatted: string;
      };
      assert.match(quoteBody.quoteId, /^fxq_/);
      assert.match(quoteBody.netTargetFormatted, /^£1,18/);

      // 3. Day-Zero UK eVisa Onboarding Endpoint
      const onboardRes = await fetch(`${baseUrl}/v1/kyc/day-zero-onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'usr_e2e_01',
          fullName: 'Chinwe Okafor',
          nationality: 'NG',
          passportNumber: 'B11223344',
          nfcChipSignatureVerified: true,
          visaCategory: 'STUDENT_ROUTE',
          ukviShareCode: 'W91-827-364',
          sponsorReferenceNumber: 'CAS-LON-2026-5519',
          sponsorInstitutionName: 'Imperial College London',
          expectedArrivalDate: '2026-09-20',
        }),
      });
      assert.equal(onboardRes.status, 201);
      const onboardBody = (await onboardRes.json()) as {
        status: string;
        ukSortCode: string;
        ukAccountNumber: string;
      };
      assert.equal(onboardBody.status, 'DAY_ZERO_ACTIVE');
      assert.equal(onboardBody.ukSortCode, '04-00-88');
      assert.equal(onboardBody.ukAccountNumber.length, 8);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });
});
