import { describe, it, expect } from 'vitest';
import {
  formatAmount,
  formatAmountInput,
  formatPrice,
  formatPriceInput,
  formatUsd,
  formatUsdInput,
  formatUsdWithSymbol,
} from '../format';

describe('formatPrice', () => {
  it('should format zero as "0.00"', () => {
    expect(formatPrice(0)).toBe('0.00');
  });

  it('should format very small prices to 8 decimal places', () => {
    expect(formatPrice(0.00001234)).toBe('0.00001234');
    expect(formatPrice(0.00000001)).toBe('0.00000001');
  });

  it('should format small prices (< 1) to 4 decimal places', () => {
    expect(formatPrice(0.5)).toBe('0.5000');
    expect(formatPrice(0.1234)).toBe('0.1234');
    expect(formatPrice(0.0012)).toBe('0.0012');
  });

  it('should format standard prices (>= 1) with 2 decimal places and locale formatting', () => {
    const result = formatPrice(50000);
    // Should contain "50,000.00" (en-US locale)
    expect(result).toBe('50,000.00');
  });

  it('should format prices between 1 and 10 correctly', () => {
    const result = formatPrice(1.5);
    expect(result).toBe('1.50');
  });

  it('should handle boundary between small and very small (0.0001)', () => {
    // 0.0001 is >= 0.0001 so it should use 4 decimal places
    expect(formatPrice(0.0001)).toBe('0.0001');
    // 0.00009999 is < 0.0001 so it should use 8 decimal places
    expect(formatPrice(0.00009999)).toBe('0.00009999');
  });
});

describe('formatAmount', () => {
  it('should format crypto amounts with a fixed 6 decimal places', () => {
    expect(formatAmount(1.5)).toBe('1.500000');
    expect(formatAmount(0.1234)).toBe('0.123400');
  });

  it('should guard against non-finite values', () => {
    expect(formatAmount(Number.NaN)).toBe('0.000000');
    expect(formatAmount(Number.POSITIVE_INFINITY)).toBe('0.000000');
  });

  it('should truncate input amounts instead of rounding them up', () => {
    expect(formatAmountInput(1.2345678)).toBe('1.234567');
    expect(formatAmountInput(0.0000009)).toBe('0.000000');
  });
});

describe('formatUsd', () => {
  it('should format USD with 2 decimals by default', () => {
    expect(formatUsd(50000)).toBe('50,000.00');
    expect(formatUsdWithSymbol(50000)).toBe('$50,000.00');
  });

  it('should support caller-provided precision options', () => {
    expect(formatUsdWithSymbol(50000, { minimumFractionDigits: 0, maximumFractionDigits: 0 })).toBe(
      '$50,000'
    );
    expect(
      formatUsdWithSymbol(0.1234, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
    ).toBe('$0.1234');
  });

  it('should truncate USD input values instead of rounding them up', () => {
    expect(formatUsdInput(123.459)).toBe('123.45');
    expect(formatUsdInput(0.009)).toBe('0.00');
  });
});

describe('formatPriceInput', () => {
  it('should format large prices without locale separators for input fields', () => {
    expect(formatPriceInput(50000)).toBe('50000.00');
  });

  it('should preserve small-price precision rules for input fields', () => {
    expect(formatPriceInput(0.5)).toBe('0.5000');
    expect(formatPriceInput(0.00001234)).toBe('0.00001234');
  });
});
