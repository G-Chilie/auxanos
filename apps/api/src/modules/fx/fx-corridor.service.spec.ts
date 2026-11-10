import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LedgerService } from '../ledger/ledger.service';
import { FxCorridorService } from './fx-corridor.service';

describe('FxCorridorService (NGN, GHS, KES -> GBP Quoting & Atomic Settlement)', () => {
  it('lists all three supported African-to-UK corridors (Nigeria, Ghana, Kenya)', () => {
    const ledger = new LedgerService();
    const fx = new FxCorridorService(ledger);

    const corridors = fx.getSupportedCorridors();
    assert.equal(corridors.length, 3);
    assert.deepEqual(
      corridors.map((c) => c.pair),
      ['NGN->GBP', 'GHS->GBP', 'KES->GBP'],
    );
  });

  it('calculates accurate minor-unit GBP output and executes two-leg double-entry settlement', () => {
    const ledger = new LedgerService();
    const fx = new FxCorridorService(ledger);

    // Provision User NGN wallet (funded with ₦2,102,722.50 = 210,272,250 kobo) and User UK GBP wallet
    const userNgnWallet = ledger.provisionWallet({
      userId: 'usr_chinwe_01',
      currency: 'NGN',
      initialTreasurySeedMinor: 210_272_250n,
    });
    const userGbpWallet = ledger.provisionWallet({
      userId: 'usr_chinwe_01',
      currency: 'GBP',
      ukSortCode: '04-00-88',
      ukAccountNumber: '73829104',
    });

    // Provision AUXANOS Treasury & Revenue Wallets
    const ngnTreasury = ledger.provisionWallet({
      userId: 'auxanos_treasury',
      currency: 'NGN',
    });
    const gbpTreasury = ledger.provisionWallet({
      userId: 'auxanos_treasury',
      currency: 'GBP',
      initialTreasurySeedMinor: 5_000_000n, // £50,000.00 liquidity pool
    });
    const gbpFeeRevenue = ledger.provisionWallet({
      userId: 'auxanos_revenue',
      currency: 'GBP',
    });

    const quote = fx.createCorridorQuote({
      sourceCurrency: 'NGN',
      targetCurrency: 'GBP',
      sourceAmountMinor: 210_272_250n,
    });

    const settlement = fx.executeQuoteSettlement({
      quoteId: quote.quoteId,
      idempotencyKey: 'idem_settle_ngn_gbp_001',
      userSourceWalletId: userNgnWallet.id,
      corridorSourceTreasuryWalletId: ngnTreasury.id,
      corridorTargetTreasuryWalletId: gbpTreasury.id,
      userTargetWalletId: userGbpWallet.id,
      platformFeeRevenueWalletId: gbpFeeRevenue.id,
    });

    assert.equal(ledger.getWallet(userNgnWallet.id).balance.amountMinor, 0n);
    assert.equal(
      ledger.getWallet(userGbpWallet.id).balance.amountMinor,
      settlement.creditedNetAmount.amountMinor,
    );
    assert.equal(
      ledger.getWallet(gbpFeeRevenue.id).balance.format(),
      '£1.50',
    );
    assert.deepEqual(ledger.verifyAuditChainIntegrity(), {
      isValid: true,
      verifiedEntries: 2,
    });
  });
});
