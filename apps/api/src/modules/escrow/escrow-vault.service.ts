import { CurrencyCode, Money } from '@auxanos/shared';
import { createHash, randomUUID } from 'node:crypto';
import { CommittedJournalEntry, LedgerService } from '../ledger/ledger.service';

export type EscrowCategory = 'UK_UNIVERSITY_TUITION' | 'UK_LANDLORD_RENT';
export type EscrowStatus = 'LOCKED' | 'PARTIALLY_RELEASED' | 'COMPLETED';

export interface CreateEscrowVaultInput {
  userId: string;
  idempotencyKey: string;
  userSourceWalletId: string;
  beneficiaryWalletId: string;
  beneficiaryName: string; // e.g., "University of Manchester" or "Sanctuary Student Homes UK"
  category: EscrowCategory;
  currency: CurrencyCode;
  totalLockedMinor: bigint;
}

export interface EscrowVaultRecord {
  vaultId: string;
  guaranteeCertificateCode: string;
  certificateVerificationHash: string;
  userId: string;
  escrowHoldWalletId: string;
  beneficiaryWalletId: string;
  beneficiaryName: string;
  category: EscrowCategory;
  currency: CurrencyCode;
  initialLockedAmount: Money;
  remainingLockedAmount: Money;
  status: EscrowStatus;
  lockJournalEntry: CommittedJournalEntry;
  createdAt: string;
}

export interface ReleaseEscrowMilestoneInput {
  vaultId: string;
  idempotencyKey: string;
  releaseAmountMinor: bigint;
  milestoneReference: string;
}

export interface EscrowReleaseResult {
  vaultId: string;
  releasedAmount: Money;
  remainingLockedAmount: Money;
  status: EscrowStatus;
  releaseJournalEntry: CommittedJournalEntry;
}

export class EscrowVaultService {
  private readonly vaults = new Map<string, EscrowVaultRecord>();

  constructor(private readonly ledgerService: LedgerService) {}

  /**
   * Locks funds from a newcomer's wallet into an isolated AUXANOS Escrow Hold Wallet
   * and issues a verifiable Proof-of-Funds Guarantee Certificate for UK Landlords or Universities.
   */
  public createAndLockVault(
    input: CreateEscrowVaultInput,
  ): EscrowVaultRecord {
    const lockedMoney = Money.fromMinor(input.totalLockedMinor, input.currency);
    if (!lockedMoney.isPositive()) {
      throw new Error('Escrow lock amount must be strictly greater than zero.');
    }

    const vaultId = `vlt_${randomUUID().slice(0, 10)}`;

    // Provision an isolated escrow hold wallet in the ledger for this specific vault
    const holdWallet = this.ledgerService.provisionWallet({
      userId: `escrow_hold_${input.userId}`,
      currency: input.currency,
      localAccountRef: `ESCROW-${vaultId.toUpperCase()}`,
    });

    // Atomically transfer funds from the user's primary wallet into the escrow hold wallet
    const lockJournalEntry = this.ledgerService.recordJournalEntry({
      idempotencyKey: input.idempotencyKey,
      reference: `ESCROW-LOCK-${vaultId}`,
      description: `Escrow lock for ${input.beneficiaryName} (${input.category})`,
      currency: input.currency,
      postings: [
        {
          walletId: input.userSourceWalletId,
          direction: 'DEBIT',
          amountMinor: lockedMoney.amountMinor,
        },
        {
          walletId: holdWallet.id,
          direction: 'CREDIT',
          amountMinor: lockedMoney.amountMinor,
        },
      ],
    });

    const guaranteeCertificateCode = `AUX-GUAR-${randomUUID().slice(0, 6).toUpperCase()}`;
    const createdAt = new Date().toISOString();

    const certificateVerificationHash = createHash('sha256')
      .update(
        `${vaultId}:${guaranteeCertificateCode}:${input.beneficiaryName}:${lockedMoney.amountMinor.toString()}:${createdAt}`,
      )
      .digest('hex');

    const record: EscrowVaultRecord = {
      vaultId,
      guaranteeCertificateCode,
      certificateVerificationHash,
      userId: input.userId,
      escrowHoldWalletId: holdWallet.id,
      beneficiaryWalletId: input.beneficiaryWalletId,
      beneficiaryName: input.beneficiaryName,
      category: input.category,
      currency: input.currency,
      initialLockedAmount: lockedMoney,
      remainingLockedAmount: lockedMoney,
      status: 'LOCKED',
      lockJournalEntry,
      createdAt,
    };

    this.vaults.set(vaultId, record);
    return record;
  }

  /**
   * Releases a scheduled rent or tuition installment from the Escrow Hold Wallet
   * directly to the verified UK Landlord or University beneficiary wallet.
   */
  public releaseEscrowMilestone(
    input: ReleaseEscrowMilestoneInput,
  ): EscrowReleaseResult {
    const vault = this.vaults.get(input.vaultId);
    if (!vault) {
      throw new Error(`Escrow vault ${input.vaultId} not found.`);
    }

    if (vault.status === 'COMPLETED') {
      throw new Error(
        `Escrow vault ${input.vaultId} has already been fully released.`,
      );
    }

    const releaseAmount = Money.fromMinor(
      input.releaseAmountMinor,
      vault.currency,
    );
    if (!releaseAmount.isPositive()) {
      throw new Error('Milestone release amount must be strictly positive.');
    }

    if (!vault.remainingLockedAmount.greaterThanOrEqual(releaseAmount)) {
      throw new Error(
        `Release amount (${releaseAmount.format()}) exceeds remaining locked escrow balance (${vault.remainingLockedAmount.format()}).`,
      );
    }

    const releaseJournalEntry = this.ledgerService.recordJournalEntry({
      idempotencyKey: input.idempotencyKey,
      reference: input.milestoneReference,
      description: `Escrow milestone release to ${vault.beneficiaryName}`,
      currency: vault.currency,
      postings: [
        {
          walletId: vault.escrowHoldWalletId,
          direction: 'DEBIT',
          amountMinor: releaseAmount.amountMinor,
        },
        {
          walletId: vault.beneficiaryWalletId,
          direction: 'CREDIT',
          amountMinor: releaseAmount.amountMinor,
        },
      ],
    });

    vault.remainingLockedAmount =
      vault.remainingLockedAmount.subtract(releaseAmount);
    vault.status = vault.remainingLockedAmount.isZero()
      ? 'COMPLETED'
      : 'PARTIALLY_RELEASED';

    return {
      vaultId: vault.vaultId,
      releasedAmount: releaseAmount,
      remainingLockedAmount: vault.remainingLockedAmount,
      status: vault.status,
      releaseJournalEntry,
    };
  }
}
