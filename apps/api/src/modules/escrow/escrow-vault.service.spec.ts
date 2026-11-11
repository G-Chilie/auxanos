import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LedgerService } from '../ledger/ledger.service';
import { EscrowVaultService } from './escrow-vault.service';

describe('EscrowVaultService (UK Rent & University Tuition Proof-of-Funds Escrow)', () => {
  it('locks GBP rent funds in an isolated escrow vault and releases scheduled milestones to a UK landlord', () => {
    const ledger = new LedgerService();
    const escrow = new EscrowVaultService(ledger);

    const studentUkWallet = ledger.provisionWallet({
      userId: 'usr_student_01',
      currency: 'GBP',
      ukSortCode: '04-00-88',
      ukAccountNumber: '73829104',
      initialTreasurySeedMinor: 600_000n, // £6,000.00
    });

    const ukLandlordWallet = ledger.provisionWallet({
      userId: 'landlord_manchester_01',
      currency: 'GBP',
    });

    // Lock 6 months of UK student accommodation rent (£4,800.00 = 480,000 pence)
    const vault = escrow.createAndLockVault({
      userId: 'usr_student_01',
      idempotencyKey: 'idem_escrow_lock_rent_01',
      userSourceWalletId: studentUkWallet.id,
      beneficiaryWalletId: ukLandlordWallet.id,
      beneficiaryName: 'Manchester Student Residences Ltd',
      category: 'UK_LANDLORD_RENT',
      currency: 'GBP',
      totalLockedMinor: 480_000n,
    });

    assert.match(vault.guaranteeCertificateCode, /^AUX-GUAR-/);
    assert.equal(vault.certificateVerificationHash.length, 64);
    assert.equal(vault.status, 'LOCKED');
    assert.equal(
      ledger.getWallet(studentUkWallet.id).balance.format(),
      '£1,200.00',
    );

    // Release Month 1 rent (£800.00 = 80,000 pence) to the landlord
    const month1Release = escrow.releaseEscrowMilestone({
      vaultId: vault.vaultId,
      idempotencyKey: 'idem_escrow_rel_month_1',
      releaseAmountMinor: 80_000n,
      milestoneReference: 'RENT-MONTH-01',
    });

    assert.equal(month1Release.status, 'PARTIALLY_RELEASED');
    assert.equal(month1Release.remainingLockedAmount.format(), '£4,000.00');
    assert.equal(
      ledger.getWallet(ukLandlordWallet.id).balance.format(),
      '£800.00',
    );
  });

  it('prevents releasing more than the locked escrow balance', () => {
    const ledger = new LedgerService();
    const escrow = new EscrowVaultService(ledger);

    const studentWallet = ledger.provisionWallet({
      userId: 'usr_student_02',
      currency: 'GBP',
      initialTreasurySeedMinor: 200_000n, // £2,000.00
    });
    const universityWallet = ledger.provisionWallet({
      userId: 'uni_uk_01',
      currency: 'GBP',
    });

    const vault = escrow.createAndLockVault({
      userId: 'usr_student_02',
      idempotencyKey: 'idem_escrow_tuition_01',
      userSourceWalletId: studentWallet.id,
      beneficiaryWalletId: universityWallet.id,
      beneficiaryName: 'University of Leeds',
      category: 'UK_UNIVERSITY_TUITION',
      currency: 'GBP',
      totalLockedMinor: 150_000n, // £1,500.00
    });

    assert.throws(
      () =>
        escrow.releaseEscrowMilestone({
          vaultId: vault.vaultId,
          idempotencyKey: 'idem_escrow_over_release',
          releaseAmountMinor: 200_000n, // £2,000.00 > £1,500.00 locked
          milestoneReference: 'TUITION-OVER',
        }),
      /exceeds remaining locked escrow balance/,
    );
  });
});
