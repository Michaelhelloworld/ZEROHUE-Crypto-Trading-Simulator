import { describe, it, expect } from 'vitest';
import { roundUSD, roundPrice, roundCrypto, isDust } from '../math';

describe('roundUSD', () => {
  it('should round to 2 decimal places', () => {
    expect(roundUSD(10.456)).toBe(10.46);
    expect(roundUSD(10.454)).toBe(10.45);
    expect(roundUSD(10.455)).toBe(10.46); // Round-half-up via EPSILON
  });

  it('should handle zero', () => {
    expect(roundUSD(0)).toBe(0);
  });

  it('should handle negative values', () => {
    expect(roundUSD(-5.678)).toBe(-5.68);
  });

  it('should handle very small values', () => {
    expect(roundUSD(0.001)).toBe(0);
    expect(roundUSD(0.005)).toBe(0.01);
  });

  it('should handle large values', () => {
    expect(roundUSD(123456.789)).toBe(123456.79);
  });
});

describe('roundCrypto', () => {
  it('should round to 8 decimal places', () => {
    expect(roundCrypto(0.123456789)).toBe(0.12345679);
  });

  it('should handle zero', () => {
    expect(roundCrypto(0)).toBe(0);
  });

  it('should preserve full 8-digit precision', () => {
    expect(roundCrypto(1.12345678)).toBe(1.12345678);
  });

  it('should handle very small crypto amounts', () => {
    expect(roundCrypto(0.00000001)).toBe(0.00000001);
  });
});

describe('roundPrice', () => {
  it('should preserve low-priced asset precision', () => {
    expect(roundPrice(0.00001235235235)).toBe(0.00001235);
    expect(roundPrice(0.000000019)).toBe(0.00000002);
  });

  it('should still handle larger prices safely', () => {
    expect(roundPrice(123.456789876)).toBe(123.45678988);
  });
});

describe('isDust', () => {
  it('should return true for amounts below dust threshold', () => {
    expect(isDust(0)).toBe(true);
    expect(isDust(0.000000001)).toBe(true);
    expect(isDust(-0.000000001)).toBe(true);
  });

  it('should return false for amounts at or above dust threshold', () => {
    expect(isDust(0.00000001)).toBe(false);
    expect(isDust(0.1)).toBe(false);
    expect(isDust(1)).toBe(false);
  });

  it('should handle negative amounts symmetrically', () => {
    expect(isDust(-0.000000009)).toBe(true);
    expect(isDust(-0.00000001)).toBe(false);
  });
});
