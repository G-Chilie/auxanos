import { CURRENCIES, CurrencyCode, isSupportedCurrency } from './currencies';

/**
 * Immutable Value Object representing a monetary amount in exact integer minor units.
 * Eliminates IEEE-754 floating-point errors across all ledger, wallet, and FX calculations.
 */
export class Money {
  public readonly amountMinor: bigint;
  public readonly currency: CurrencyCode;

  private constructor(amountMinor: bigint, currency: CurrencyCode) {
    if (!isSupportedCurrency(currency)) {
      throw new Error(`Unsupported currency code: ${String(currency)}`);
    }
    this.amountMinor = amountMinor;
    this.currency = currency;
    Object.freeze(this);
  }

  /**
   * Creates a Money instance directly from integer minor units (e.g., 1050n pence = £10.50).
   */
  public static fromMinor(
    amountMinor: bigint | number | string,
    currency: CurrencyCode,
  ): Money {
    if (typeof amountMinor === 'number' && !Number.isInteger(amountMinor)) {
      throw new Error(
        `Money.fromMinor requires an exact integer, received decimal: ${amountMinor}`,
      );
    }
    return new Money(BigInt(amountMinor), currency);
  }

  /**
   * Creates a zero-balance Money instance for the given currency.
   */
  public static zero(currency: CurrencyCode): Money {
    return new Money(0n, currency);
  }

  /**
   * Asserts that two Money instances share the exact same currency before arithmetic.
   */
  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Currency mismatch: cannot combine ${this.currency} with ${other.currency} without an explicit FX conversion.`,
      );
    }
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor - other.amountMinor, this.currency);
  }

  public isPositive(): boolean {
    return this.amountMinor > 0n;
  }

  public isZero(): boolean {
    return this.amountMinor === 0n;
  }

  public isNegative(): boolean {
    return this.amountMinor < 0n;
  }

  public greaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amountMinor >= other.amountMinor;
  }

  public equals(other: Money): boolean {
    return (
      this.currency === other.currency && this.amountMinor === other.amountMinor
    );
  }

  /**
   * Calculates a fee or spread in basis points (100 bps = 1.00%) using integer math.
   */
  public calculateBasisPoints(bps: number): Money {
    if (!Number.isInteger(bps) || bps < 0) {
      throw new Error(`Basis points must be a non-negative integer, got ${bps}`);
    }
    const feeMinor = (this.amountMinor * BigInt(bps)) / 10_000n;
    return new Money(feeMinor, this.currency);
  }

  /**
   * Formats the minor unit balance into a standard human-readable string (e.g., "£1,250.50").
   */
  public format(): string {
    const meta = CURRENCIES[this.currency];
    const isNeg = this.amountMinor < 0n;
    const absMinor = isNeg ? -this.amountMinor : this.amountMinor;

    const majorPart = absMinor / meta.minorUnitsPerMajor;
    const minorPart = absMinor % meta.minorUnitsPerMajor;

    const formattedMajor = majorPart
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const formattedMinor = minorPart.toString().padStart(meta.decimals, '0');

    return `${isNeg ? '-' : ''}${meta.symbol}${formattedMajor}.${formattedMinor}`;
  }
}
