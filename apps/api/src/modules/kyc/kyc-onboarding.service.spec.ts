import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LedgerService } from '../ledger/ledger.service';
import { KycOnboardingService } from './kyc-onboarding.service';

describe('KycOnboardingService (Day-Zero UK eVisa & Anti-Freeze Guard)', () => {
  it('activates a Day-Zero UK GBP Sort Code & Account Number plus paired NGN NUBAN for a verified Nigerian student', () => {
    const ledger = new LedgerService();
    const kyc = new KycOnboardingService(ledger);

    const result = kyc.completeDayZeroOnboarding({
      userId: 'usr_ng_student_01',
      fullName: 'Chinwe Okafor',
      nationality: 'NG',
      passportNumber: 'B09482711',
      nfcChipSignatureVerified: true,
      visaCategory: 'STUDENT_ROUTE',
      ukviShareCode: 'S48-920-114',
      sponsorReferenceNumber: 'CAS-MAN-2026-88412',
      sponsorInstitutionName: 'University of Manchester',
      expectedArrivalDate: '2026-09-14',
    });

    assert.equal(result.status, 'DAY_ZERO_ACTIVE');
    assert.ok(result.trustScore >= 90);
    assert.equal(result.ukSortCode, '04-00-88');
    assert.equal(result.ukAccountNumber.length, 8);
    assert.equal(result.homeCorridorCurrency, 'NGN');
    assert.match(result.localCorridorCollectionRef, /^NUBAN-99/);

    const userWallets = ledger.getUserWallets('usr_ng_student_01');
    assert.equal(userWallets.length, 2);
  });

  it('rejects malformed UKVI Share Codes', () => {
    const ledger = new LedgerService();
    const kyc = new KycOnboardingService(ledger);

    assert.throws(
      () =>
        kyc.completeDayZeroOnboarding({
          userId: 'usr_invalid_01',
          fullName: 'Kwame Mensah',
          nationality: 'GH',
          passportNumber: 'G8821902',
          nfcChipSignatureVerified: true,
          visaCategory: 'SKILLED_WORKER',
          ukviShareCode: 'INVALID-12',
          sponsorReferenceNumber: 'COS-NHS-99201',
          sponsorInstitutionName: 'NHS Foundation Trust',
          expectedArrivalDate: '2026-10-01',
        }),
      /Invalid UKVI eVisa Share Code format/,
    );
  });

  it('issues an Anti-Freeze Source-of-Funds Pre-Clearance certificate for Kenya/Ghana/Nigeria tuition transfers', () => {
    const ledger = new LedgerService();
    const kyc = new KycOnboardingService(ledger);

    const cert = kyc.issueSourceOfFundsPreClearance({
      userId: 'usr_ke_01',
      originCountry: 'KE',
      sourceCurrency: 'KES',
      sponsorFullName: 'David Kamau',
      sponsorRelationship: 'PARENT',
      sponsorBankOrMobileRef: 'MPESA-KE-254712345678',
      purpose: 'UK_TUITION_DEPOSIT',
      expectedAmountMinor: 1_500_000_00n,
    });

    assert.match(cert.clearanceCode, /^AUX-CLR-/);
    assert.equal(cert.antiFreezeProtectionActive, true);
    assert.equal(cert.approvedAllowance.format(), 'KSh1,500,000.00');
  });
});
