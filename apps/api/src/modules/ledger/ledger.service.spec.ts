import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LedgerService } from './ledger.service';

describe('LedgerService (Double-Entry Core Accounting)', () => {
  it('maintains strict zero-sum conservation of funds across GBP debit and credit postings', () => {
    const ledger = new LedgerService();

    const treasury = ledger.provisionWallet({
      userId: 'system_treasury',
      currency: 'GBP',
      initialTreasurySeedMinor: 1_000_000n, // £10,000.00
    });

    const studentUkWallet = ledger.provisionWallet({
      userId: 'user_chinwe_01',
      currency: 'GBP',
      ukSortCode: '04-00-88',
      ukAccountNumber: '73829104',
    });

    const journal = ledger.recordJournalEntry({
      idempotencyKey: 'idem_uk_deposit_001',
      reference: 'FPS-2026-99102',
      description: 'Day-Zero UK Living Stipend Settlement',
      currency: 'GBP',
      postings: [
        { walletId: treasury.id, direction: 'DEBIT', amountMinor: 150_000n },
        {
          walletId: studentUkWallet.id,
          direction: 'CREDIT',
          amountMinor: 150_000n,
        },
      ],
    });

    assert.equal(journal.entryHash.length, 64);
    assert.equal(ledger.getWallet(treasury.id).balance.format(), '£8,500.00');
    assert.equal(
      ledger.getWallet(studentUkWallet.id).balance.format(),
      '£1,500.00',
    );
  });

  it('rejects unbalanced journal entries where DEBIT !== CREDIT', () => {
    const ledger = new LedgerService();

    const walletA = ledger.provisionWallet({
      userId: 'user_a',
      currency: 'NGN',
      initialTreasurySeedMinor: 500_000_00n,
    });
    const walletB = ledger.provisionWallet({
      userId: 'user_b',
      currency: 'NGN',
    });

    assert.throws(
      () =>
        ledger.recordJournalEntry({
          idempotencyKey: 'idem_unbalanced_001',
          reference: 'ERR-001',
          description: 'Mismatched posting legs',
          currency: 'NGN',
          postings: [
            { walletId: walletA.id, direction: 'DEBIT', amountMinor: 100_000n },
            { walletId: walletB.id, direction: 'CREDIT', amountMinor: 95_000n },
          ],
        }),
      /Double-entry invariant violation/,
    );
  });

  it('enforces idempotency so duplicate webhook retries never double-credit a wallet', () => {
    const ledger = new LedgerService();

    const treasury = ledger.provisionWallet({
      userId: 'treasury_ghs',
      currency: 'GHS',
      initialTreasurySeedMinor: 500_000n,
    });
    const userWallet = ledger.provisionWallet({
      userId: 'user_accra_01',
      currency: 'GHS',
    });

    const payload = {
      idempotencyKey: 'idem_ghs_momo_retry_test',
      reference: 'MOMO-GH-8821',
      description: 'Accra to UK Tuition Top-up',
      currency: 'GHS' as const,
      postings: [
        {
          walletId: treasury.id,
          direction: 'DEBIT' as const,
          amountMinor: 50_000n,
        },
        {
          walletId: userWallet.id,
          direction: 'CREDIT' as const,
          amountMinor: 50_000n,
        },
      ],
    };

    const firstAttempt = ledger.recordJournalEntry(payload);
    const duplicateRetry = ledger.recordJournalEntry(payload);

    assert.equal(duplicateRetry.id, firstAttempt.id);
    assert.equal(ledger.getWallet(userWallet.id).balance.format(), 'GH₵500.00');
    assert.deepEqual(ledger.verifyAuditChainIntegrity(), {
      isValid: true,
      verifiedEntries: 1,
    });
  });
});
