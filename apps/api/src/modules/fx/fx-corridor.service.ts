import { CurrencyCode, Money } from '@auxanos/shared';
import { randomUUID } from 'node:crypto';
import { CommittedJournalEntry, LedgerService } from '../ledger/ledger.service';

export interface CorridorRateConfig {
  pair: string;
  sourceCurrency: CurrencyCode;
  targetCurrency: CurrencyCode;
  midMarketUnitsPerGbp: number;
  spreadBps: number;
  corridorName: string;
  settlementRail: string;
}

export interface FxQuote {
  quoteId: string;
  sourceCurrency: CurrencyCode;
  targetCurrency: CurrencyCode;
  sourceAmount: Money;
  grossTargetAmount: Money;
  feeTargetAmount: Money;
  netTargetAmount: Money;
  effectiveRateUnitsPerGbp: number;
  corridorName: string;
  settlementRail: string;
  expiresAt: string;
  isExecuted: boolean;
}

export interface ExecuteQuoteSettlementParams {
  quoteId: string;
  idempotencyKey: string;
  userSourceWalletId: string;
  corridorSourceTreasuryWalletId: string;
  corridorTargetTreasuryWalletId: string;
  userTargetWalletId: string;
  platformFeeRevenueWalletId: string;
}

export interface SettlementExecutionResult {
  quoteId: string;
  sourceLegJournal: CommittedJournalEntry;
  targetLegJournal: CommittedJournalEntry;
  creditedNetAmount: Money;
  platformFeeCollected: Money;
}

export class FxCorridorService {
  private readonly quotes = new Map<string, FxQuote>();

  private readonly corridors: Readonly<Record<string, CorridorRateConfig>> = {
    'NGN->GBP': {
      pair: 'NGN->GBP',
      sourceCurrency: 'NGN',
      targetCurrency: 'GBP',
      midMarketUnitsPerGbp: 2085.0,
      spreadBps: 85,
      corridorName: 'Nigeria (NGN) -> United Kingdom (GBP)',
      settlementRail: 'Paystack NUBAN -> UK Faster Payments (FPS)',
    },
    'GHS->GBP': {
      pair: 'GHS->GBP',
      sourceCurrency: 'GHS',
      targetCurrency: 'GBP',
      midMarketUnitsPerGbp: 20.4,
      spreadBps: 90,
      corridorName: 'Ghana (GHS) -> United Kingdom (GBP)',
      settlementRail: 'Ghana Mobile Money / GIP -> UK Faster Payments (FPS)',
    },
    'KES->GBP': {
      pair: 'KES->GBP',
      sourceCurrency: 'KES',
      targetCurrency: 'GBP',
      midMarketUnitsPerGbp: 168.5,
      spreadBps: 75,
      corridorName: 'Kenya (KES) -> United Kingdom (GBP)',
      settlementRail: 'Safaricom M-Pesa -> UK Faster Payments (FPS)',
    },
  };

  constructor(private readonly ledgerService: LedgerService) {}

  public getSupportedCorridors(): CorridorRateConfig[] {
    return Object.values(this.corridors);
  }

  /**
   * Generates a 15-minute rate-locked FX quote for converting NGN, GHS, or KES into UK GBP.
   */
  public createCorridorQuote(params: {
    sourceCurrency: CurrencyCode;
    targetCurrency: CurrencyCode;
    sourceAmountMinor: bigint;
  }): FxQuote {
    const sourceAmount = Money.fromMinor(
      params.sourceAmountMinor,
      params.sourceCurrency,
    );
    if (!sourceAmount.isPositive()) {
      throw new Error(
        'Source amount in minor units must be strictly positive.',
      );
    }

    const pairKey = `${params.sourceCurrency}->${params.targetCurrency}`;
    const config = this.corridors[pairKey];

    if (!config) {
      throw new Error(
        `Unsupported corridor pair ${pairKey}. Supported inbound UK corridors: NGN->GBP, GHS->GBP, KES->GBP.`,
      );
    }

    const spreadFactor = 1 + config.spreadBps / 10_000;
    const effectiveRateUnitsPerGbp = Number(
      (config.midMarketUnitsPerGbp * spreadFactor).toFixed(4),
    );

    const rateScaled = BigInt(Math.round(effectiveRateUnitsPerGbp * 10_000));
    const grossTargetMinor =
      (sourceAmount.amountMinor * 10_000n) / rateScaled;

    if (grossTargetMinor <= 0n) {
      throw new Error(
        'Source amount is too small to convert to at least £0.01 (1 penny).',
      );
    }

    const grossTargetAmount = Money.fromMinor(
      grossTargetMinor,
      params.targetCurrency,
    );
    const feeMinor = grossTargetMinor > 5_000n ? 150n : 0n;
    const feeTargetAmount = Money.fromMinor(feeMinor, params.targetCurrency);
    const netTargetAmount = grossTargetAmount.subtract(feeTargetAmount);

    const quote: FxQuote = {
      quoteId: `fxq_${randomUUID().slice(0, 10)}`,
      sourceCurrency: params.sourceCurrency,
      targetCurrency: params.targetCurrency,
      sourceAmount,
      grossTargetAmount,
      feeTargetAmount,
      netTargetAmount,
      effectiveRateUnitsPerGbp,
      corridorName: config.corridorName,
      settlementRail: config.settlementRail,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      isExecuted: false,
    };

    this.quotes.set(quote.quoteId, quote);
    return quote;
  }

  /**
   * Executes a locked FX quote through the Double-Entry Ledger across two linked currency legs:
   * Leg 1 (Source Currency): DEBIT User Source Wallet -> CREDIT Corridor Source Treasury
   * Leg 2 (Target Currency): DEBIT Corridor Target Treasury -> CREDIT User UK GBP Wallet + CREDIT Platform Fee Wallet
   */
  public executeQuoteSettlement(
    params: ExecuteQuoteSettlementParams,
  ): SettlementExecutionResult {
    const quote = this.quotes.get(params.quoteId);
    if (!quote) {
      throw new Error(`FX Quote ${params.quoteId} not found.`);
    }

    if (quote.isExecuted) {
      throw new Error(`FX Quote ${params.quoteId} has already been executed.`);
    }

    if (new Date(quote.expiresAt).getTime() < Date.now()) {
      throw new Error(`FX Quote ${params.quoteId} has expired.`);
    }

    // Leg 1: Collect source currency from user's local corridor wallet into AUXANOS Source Treasury
    const sourceLegJournal = this.ledgerService.recordJournalEntry({
      idempotencyKey: `${params.idempotencyKey}_leg1_src`,
      reference: `FX-${quote.quoteId}-SRC`,
      description: `Corridor collection (${quote.corridorName})`,
      currency: quote.sourceCurrency,
      postings: [
        {
          walletId: params.userSourceWalletId,
          direction: 'DEBIT',
          amountMinor: quote.sourceAmount.amountMinor,
        },
        {
          walletId: params.corridorSourceTreasuryWalletId,
          direction: 'CREDIT',
          amountMinor: quote.sourceAmount.amountMinor,
        },
      ],
    });

    // Leg 2: Disburse net GBP from AUXANOS UK Treasury into User UK Account + Platform Fee Revenue
    const targetPostings = [
      {
        walletId: params.corridorTargetTreasuryWalletId,
        direction: 'DEBIT' as const,
        amountMinor: quote.grossTargetAmount.amountMinor,
      },
      {
        walletId: params.userTargetWalletId,
        direction: 'CREDIT' as const,
        amountMinor: quote.netTargetAmount.amountMinor,
      },
    ];

    if (quote.feeTargetAmount.isPositive()) {
      targetPostings.push({
        walletId: params.platformFeeRevenueWalletId,
        direction: 'CREDIT' as const,
        amountMinor: quote.feeTargetAmount.amountMinor,
      });
    }

    const targetLegJournal = this.ledgerService.recordJournalEntry({
      idempotencyKey: `${params.idempotencyKey}_leg2_tgt`,
      reference: `FX-${quote.quoteId}-TGT`,
      description: `UK Faster Payments settlement (${quote.corridorName})`,
      currency: quote.targetCurrency,
      postings: targetPostings,
    });

    quote.isExecuted = true;

    return {
      quoteId: quote.quoteId,
      sourceLegJournal,
      targetLegJournal,
      creditedNetAmount: quote.netTargetAmount,
      platformFeeCollected: quote.feeTargetAmount,
    };
  }
}
