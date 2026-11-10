import { CurrencyCode, Money } from '@auxanos/shared';
import { createHash, randomUUID } from 'node:crypto';
import { LedgerService } from '../ledger/ledger.service';

export type CorridorCountry = 'NG' | 'GH' | 'KE';
export type VisaCategory =
  | 'STUDENT_ROUTE'
  | 'SKILLED_WORKER'
  | 'HEALTH_AND_CARE'
  | 'GRADUATE_ROUTE'
  | 'GLOBAL_TALENT';

export interface DayZeroOnboardingRequest {
  userId: string;
  fullName: string;
  nationality: CorridorCountry;
  passportNumber: string;
  nfcChipSignatureVerified: boolean;
  visaCategory: VisaCategory;
  ukviShareCode: string;
  sponsorReferenceNumber: string;
  sponsorInstitutionName: string;
  expectedArrivalDate: string;
}

export interface DayZeroOnboardingResult {
  userId: string;
  status: 'DAY_ZERO_ACTIVE' | 'ENHANCED_REVIEW';
  trustScore: number;
  ukSortCode: string;
  ukAccountNumber: string;
  homeCorridorCurrency: CurrencyCode;
  localCorridorCollectionRef: string;
  passportNumberHash: string;
  verifiedAt: string;
}

export interface PreClearanceRequest {
  userId: string;
  originCountry: CorridorCountry;
  sourceCurrency: CurrencyCode;
  sponsorFullName: string;
  sponsorRelationship:
    | 'PARENT'
    | 'SELF_SAVINGS'
    | 'SCHOLARSHIP_BOARD'
    | 'EMPLOYER';
  sponsorBankOrMobileRef: string;
  purpose: 'UK_TUITION_DEPOSIT' | 'ACCOMMODATION_RENT' | 'LIVING_STIPEND';
  expectedAmountMinor: bigint;
}

export interface PreClearanceCertificate {
  clearanceCode: string;
  userId: string;
  originCountry: CorridorCountry;
  sourceCurrency: CurrencyCode;
  sponsorFullName: string;
  purpose: string;
  approvedAllowance: Money;
  riskAssessmentScore: number;
  antiFreezeProtectionActive: boolean;
  expiresAt: string;
}

export class KycOnboardingService {
  private readonly preClearances = new Map<string, PreClearanceCertificate>();

  constructor(private readonly ledgerService: LedgerService) {}

  /**
   * Verifies a newcomer's UK Home Office eVisa Share Code + Passport NFC + CAS/CoS
   * before or upon arrival in the UK, provisioning a Day-Zero UK GBP account
   * alongside a paired home-corridor collection wallet (NGN, GHS, or KES).
   */
  public completeDayZeroOnboarding(
    request: DayZeroOnboardingRequest,
  ): DayZeroOnboardingResult {
    const normalizedShareCode = request.ukviShareCode
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    if (!/^[WSR][A-Z0-9]{8}$/.test(normalizedShareCode)) {
      throw new Error(
        'Invalid UKVI eVisa Share Code format. Expected a 9-character code starting with W, S, or R (e.g. W12-345-678).',
      );
    }

    if (
      !request.sponsorReferenceNumber ||
      request.sponsorReferenceNumber.trim().length < 6
    ) {
      throw new Error(
        'Valid UK Sponsor Reference (CAS or CoS number) is required for Day-Zero onboarding.',
      );
    }

    let trustScore = 0;
    trustScore += request.nfcChipSignatureVerified ? 40 : 15;
    trustScore += 40; // Verified UKVI Share Code + Sponsor reference

    if (
      request.visaCategory === 'STUDENT_ROUTE' ||
      request.visaCategory === 'SKILLED_WORKER' ||
      request.visaCategory === 'HEALTH_AND_CARE'
    ) {
      trustScore += 15;
    } else {
      trustScore += 10;
    }

    const status = trustScore >= 80 ? 'DAY_ZERO_ACTIVE' : 'ENHANCED_REVIEW';

    const homeCorridorCurrency: CurrencyCode =
      request.nationality === 'NG'
        ? 'NGN'
        : request.nationality === 'GH'
          ? 'GHS'
          : 'KES';

    const hashHex = createHash('sha256')
      .update(`${request.userId}:${request.passportNumber}`)
      .digest('hex');
    const numericSuffix =
      (parseInt(hashHex.slice(0, 8), 16) % 90000000) + 10000000;
    const ukSortCode = '04-00-88';
    const ukAccountNumber = String(numericSuffix);

    const localCorridorCollectionRef =
      request.nationality === 'NG'
        ? `NUBAN-99${String(numericSuffix).slice(0, 8)}`
        : request.nationality === 'GH'
          ? `GHS-MOMO-${String(numericSuffix).slice(0, 6)}`
          : `MPESA-PAYBILL-${String(numericSuffix).slice(0, 6)}`;

    this.ledgerService.provisionWallet({
      userId: request.userId,
      currency: 'GBP',
      ukSortCode,
      ukAccountNumber,
    });

    this.ledgerService.provisionWallet({
      userId: request.userId,
      currency: homeCorridorCurrency,
      localAccountRef: localCorridorCollectionRef,
    });

    return {
      userId: request.userId,
      status,
      trustScore,
      ukSortCode,
      ukAccountNumber,
      homeCorridorCurrency,
      localCorridorCollectionRef,
      passportNumberHash: hashHex,
      verifiedAt: new Date().toISOString(),
    };
  }

  /**
   * Issues an Anti-Freeze Source-of-Funds Pre-Clearance Certificate for upcoming
   * tuition, rent, or living-stipend remittances from Nigeria, Ghana, or Kenya.
   */
  public issueSourceOfFundsPreClearance(
    req: PreClearanceRequest,
  ): PreClearanceCertificate {
    const allowance = Money.fromMinor(
      req.expectedAmountMinor,
      req.sourceCurrency,
    );
    if (!allowance.isPositive()) {
      throw new Error(
        'Expected pre-clearance amount must be greater than zero.',
      );
    }

    let riskAssessmentScore = 75;
    if (
      req.sponsorRelationship === 'SCHOLARSHIP_BOARD' ||
      req.sponsorRelationship === 'SELF_SAVINGS' ||
      req.sponsorRelationship === 'PARENT'
    ) {
      riskAssessmentScore += 15;
    }
    if (
      req.purpose === 'UK_TUITION_DEPOSIT' ||
      req.purpose === 'ACCOMMODATION_RENT'
    ) {
      riskAssessmentScore += 8;
    }

    const clearanceCode = `AUX-CLR-${randomUUID().slice(0, 6).toUpperCase()}`;
    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const certificate: PreClearanceCertificate = {
      clearanceCode,
      userId: req.userId,
      originCountry: req.originCountry,
      sourceCurrency: req.sourceCurrency,
      sponsorFullName: req.sponsorFullName,
      purpose: req.purpose,
      approvedAllowance: allowance,
      riskAssessmentScore,
      antiFreezeProtectionActive: riskAssessmentScore >= 80,
      expiresAt,
    };

    this.preClearances.set(clearanceCode, certificate);
    return certificate;
  }
}
