import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Money } from './money';

describe('Money Domain Primitive (@auxanos/shared)', () => {
  it('adds and subtracts minor units accurately without floating-point drift', () => {
    const a = Money.fromMinor(10n, 'GBP'); // £0.10
    const b = Money.fromMinor(20n, 'GBP'); // £0.20
    const sum = a.add(b);

    assert.equal(sum.amountMinor, 30n);
    assert.equal(sum.format(), '£0.30');
  });

  it('prevents accidentally adding two different currencies (e.g., GBP and NGN)', () => {
    const gbp = Money.fromMinor(50_000n, 'GBP');
    const ngn = Money.fromMinor(50_000n, 'NGN');

    assert.throws(
      () => gbp.add(ngn),
      /Currency mismatch: cannot combine GBP with NGN/,
    );
  });

  it('rejects non-integer floating-point numbers when constructing minor units', () => {
    assert.throws(
      () => Money.fromMinor(19.99, 'GHS'),
      /Money.fromMinor requires an exact integer/,
    );
  });

  it('calculates basis-point fees accurately across GBP, NGN, GHS, and KES', () => {
    // ₦2,500,000.00 in kobo = 250,000,000 kobo; 85 bps (0.85%) = ₦21,250.00
    const ngnTransfer = Money.fromMinor(250_000_000n, 'NGN');
    const fee = ngnTransfer.calculateBasisPoints(85);

    assert.equal(fee.amountMinor, 2_125_000n);
    assert.equal(fee.format(), '₦21,250.00');
  });
});
