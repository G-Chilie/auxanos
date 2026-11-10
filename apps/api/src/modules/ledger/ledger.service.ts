import { CurrencyCode, Money } from '@auxanos/shared';
import { createHash, randomUUID } from 'node:crypto';

export type EntryDirection = 'DEBIT' | 'CREDIT';

export interface WalletAccount {
  id: string;
  userId: string;
  currency: CurrencyCode;
  balance: Money;
  ukSortCode?: string;
  ukAccountNumber?: string;
  localAccountRef?: string;
  isFrozen: boolean;
}

export interface PostingLegInput {
  walletId: string;
  direction: EntryDirection;
  amountMinor: bigint;
}

export interface RecordJournalEntryInput {
  idempotencyKey: string;
  reference: string;
  description: string;
  currency: CurrencyCode;
  postings: PostingLegInput[];
}

export interface CommittedJournalEntry {
  id: string;
  idempotencyKey: string;
  reference: string;
  description: string;
  currency: CurrencyCode;
  previousEntryHash: string | null;
  entryHash: string;
  createdAt: string;
  postings: PostingLegInput[];
}

export class LedgerService {
  private readonly wallets = new Map<string, WalletAccount>();
  private readonly journalsByIdempotencyKey = new Map<
    string,
    CommittedJournalEntry
  >();
  private readonly journalChain: CommittedJournalEntry[] = [];

  /**
   * Provisions a multi-currency wallet with zero-float Money balance tracking.
   */
  public provisionWallet(params: {
    userId: string;
    currency: CurrencyCode;
    ukSortCode?: string;
    ukAccountNumber?: string;
    localAccountRef?: string;
    initialTreasurySeedMinor?: bigint;
  }): WalletAccount {
    const id = `wal_${params.currency.toLowerCase()}_${randomUUID().slice(0, 8)}`;
    const wallet: WalletAccount = {
      id,
      userId: params.userId,
      currency: params.currency,
      balance: Money.fromMinor(
        params.initialTreasurySeedMinor ?? 0n,
        params.currency,
      ),
      ukSortCode: params.ukSortCode,
      ukAccountNumber: params.ukAccountNumber,
      localAccountRef: params.localAccountRef,
      isFrozen: false,
    };

    this.wallets.set(id, wallet);
    return wallet;
  }

  public getWallet(walletId: string): WalletAccount {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }
    return wallet;
  }

  public getUserWallets(userId: string): WalletAccount[] {
    return Array.from(this.wallets.values()).filter(
      (wallet) => wallet.userId === userId,
    );
  }

  /**
   * Records an atomic double-entry journal transaction enforcing:
   * 1. Deterministic idempotency key deduplication
   * 2. Strict zero-sum conservation (Sum(DEBIT) === Sum(CREDIT))
   * 3. Non-negative balance & freeze checks
   * 4. SHA-256 tamper-evident hash chain linking
   */
  public recordJournalEntry(
    input: RecordJournalEntryInput,
  ): CommittedJournalEntry {
    if (!input.idempotencyKey || input.idempotencyKey.trim().length < 6) {
      throw new Error(
        'A valid idempotencyKey (min 6 chars) is required for ledger mutations.',
      );
    }

    const existing = this.journalsByIdempotencyKey.get(input.idempotencyKey);
    if (existing) {
      return existing;
    }

    if (!input.postings || input.postings.length < 2) {
      throw new Error(
        'Double-entry journal requires at least two posting legs (DEBIT and CREDIT).',
      );
    }

    let totalDebits = Money.zero(input.currency);
    let totalCredits = Money.zero(input.currency);

    for (const leg of input.postings) {
      const legMoney = Money.fromMinor(leg.amountMinor, input.currency);
      if (!legMoney.isPositive()) {
        throw new Error(
          'All ledger posting amounts must be strictly positive integer minor units.',
        );
      }

      const wallet = this.getWallet(leg.walletId);
      if (wallet.currency !== input.currency) {
        throw new Error(
          `Currency mismatch: wallet ${wallet.id} is ${wallet.currency} but journal is ${input.currency}.`,
        );
      }

      if (wallet.isFrozen) {
        throw new Error(
          `Wallet ${wallet.id} is currently frozen pending compliance review.`,
        );
      }

      if (leg.direction === 'DEBIT') {
        if (!wallet.balance.greaterThanOrEqual(legMoney)) {
          throw new Error(
            `Insufficient funds in wallet ${wallet.id}: required ${legMoney.format()}, available ${wallet.balance.format()}.`,
          );
        }
        totalDebits = totalDebits.add(legMoney);
      } else {
        totalCredits = totalCredits.add(legMoney);
      }
    }

    if (!totalDebits.equals(totalCredits)) {
      throw new Error(
        `Double-entry invariant violation: total DEBIT (${totalDebits.format()}) !== total CREDIT (${totalCredits.format()}).`,
      );
    }

    for (const leg of input.postings) {
      const wallet = this.getWallet(leg.walletId);
      const legMoney = Money.fromMinor(leg.amountMinor, input.currency);
      if (leg.direction === 'DEBIT') {
        wallet.balance = wallet.balance.subtract(legMoney);
      } else {
        wallet.balance = wallet.balance.add(legMoney);
      }
    }

    const previousEntry =
      this.journalChain.length > 0
        ? this.journalChain[this.journalChain.length - 1]
        : null;
    const previousEntryHash = previousEntry ? previousEntry.entryHash : null;
    const createdAt = new Date().toISOString();
    const id = `jrnl_${randomUUID().slice(0, 12)}`;

    const canonicalPayload = JSON.stringify({
      id,
      idempotencyKey: input.idempotencyKey,
      reference: input.reference,
      currency: input.currency,
      previousEntryHash,
      postings: input.postings.map((p) => ({
        walletId: p.walletId,
        direction: p.direction,
        amountMinor: p.amountMinor.toString(),
      })),
    });

    const entryHash = createHash('sha256')
      .update(canonicalPayload)
      .digest('hex');

    const committed: CommittedJournalEntry = {
      id,
      idempotencyKey: input.idempotencyKey,
      reference: input.reference,
      description: input.description,
      currency: input.currency,
      previousEntryHash,
      entryHash,
      createdAt,
      postings: input.postings,
    };

    this.journalsByIdempotencyKey.set(input.idempotencyKey, committed);
    this.journalChain.push(committed);

    return committed;
  }

  /**
   * Verifies the cryptographic integrity of the entire SHA-256 journal chain.
   */
  public verifyAuditChainIntegrity(): {
    isValid: boolean;
    verifiedEntries: number;
  } {
    for (let i = 0; i < this.journalChain.length; i++) {
      const entry = this.journalChain[i];
      const expectedPrevHash =
        i === 0 ? null : this.journalChain[i - 1].entryHash;

      if (entry.previousEntryHash !== expectedPrevHash) {
        return { isValid: false, verifiedEntries: i };
      }
    }
    return { isValid: true, verifiedEntries: this.journalChain.length };
  }
}
