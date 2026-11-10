export type CurrencyCode = 'GBP' | 'NGN' | 'GHS' | 'KES' | 'USD' | 'EUR';

export interface CurrencyMetadata {
  readonly code: CurrencyCode;
  readonly name: string;
  readonly symbol: string;
  readonly minorUnitName: string;
  readonly decimals: number;
  readonly minorUnitsPerMajor: bigint;
}

export const CURRENCIES: Readonly<Record<CurrencyCode, CurrencyMetadata>> = {
  GBP: {
    code: 'GBP',
    name: 'British Pound Sterling',
    symbol: '£',
    minorUnitName: 'pence',
    decimals: 2,
    minorUnitsPerMajor: 100n,
  },
  NGN: {
    code: 'NGN',
    name: 'Nigerian Naira',
    symbol: '₦',
    minorUnitName: 'kobo',
    decimals: 2,
    minorUnitsPerMajor: 100n,
  },
  GHS: {
    code: 'GHS',
    name: 'Ghanaian Cedi',
    symbol: 'GH₵',
    minorUnitName: 'pesewas',
    decimals: 2,
    minorUnitsPerMajor: 100n,
  },
  KES: {
    code: 'KES',
    name: 'Kenyan Shilling',
    symbol: 'KSh',
    minorUnitName: 'cents',
    decimals: 2,
    minorUnitsPerMajor: 100n,
  },
  USD: {
    code: 'USD',
    name: 'United States Dollar',
    symbol: '$',
    minorUnitName: 'cents',
    decimals: 2,
    minorUnitsPerMajor: 100n,
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    minorUnitName: 'cents',
    decimals: 2,
    minorUnitsPerMajor: 100n,
  },
};

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, code);
}
